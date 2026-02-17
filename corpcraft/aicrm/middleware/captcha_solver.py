"""
增强的验证码识别模块
支持多种验证码类型识别：OCR、深度学习、第三方API
"""
import os
import io
import base64
import random
import string
import asyncio
from typing import Optional, Dict, Any, List, Tuple
from enum import Enum
from dataclasses import dataclass
from loguru import logger
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np
import requests
from io import BytesIO


class CaptchaType(Enum):
    """验证码类型"""
    TEXT_IMAGE = "text_image"  # 文本图片验证码
    SLIDER = "slider"  # 滑块验证码
    CLICK = "click"  # 点击验证码（点选文字）
    RECAPTCHA_V2 = "recaptcha_v2"  # Google reCAPTCHA v2
    RECAPTCHA_V3 = "recaptcha_v3"  # Google reCAPTCHA v3
    HCAPTCHA = "hcaptcha"  # hCaptcha
    GEETEST = "geetest"  # 极验验证码
    ROTATE = "rotate"  # 旋转图片验证码
    CALCULATE = "calculate"  # 计算题验证码


@dataclass
class CaptchaResult:
    """验证码识别结果"""
    success: bool
    result: Any  # 识别结果（可能是字符串、坐标等）
    confidence: float  # 置信度 0-1
    solver: str  # 使用的识别器名称
    error: Optional[str] = None  # 错误信息
    duration: float = 0.0  # 识别耗时（秒）


class ImagePreprocessor:
    """图像预处理器"""

    @staticmethod
    def denoise(image: np.ndarray) -> np.ndarray:
        """去噪"""
        return cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)

    @staticmethod
    def to_gray(image: np.ndarray) -> np.ndarray:
        """转灰度图"""
        if len(image.shape) == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return image

    @staticmethod
    def binarize(image: np.ndarray, method: str = 'otsu') -> np.ndarray:
        """二值化"""
        if method == 'otsu':
            _, binary = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        elif method == 'adaptive':
            binary = cv2.adaptiveThreshold(
                image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 11, 2
            )
        else:
            _, binary = cv2.threshold(image, 127, 255, cv2.THRESH_BINARY)
        return binary

    @staticmethod
    def remove_lines(image: np.ndarray) -> np.ndarray:
        """移除干扰线"""
        # 使用形态学操作移除细线
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        opened = cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)
        return opened

    @staticmethod
    def enhance_contrast(image: np.ndarray) -> np.ndarray:
        """增强对比度"""
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced = cv2.merge([cl, a, b])
        return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    @staticmethod
    def resize(image: np.ndarray, scale: float = 2.0) -> np.ndarray:
        """调整图像大小"""
        height, width = image.shape[:2]
        new_size = (int(width * scale), int(height * scale))
        return cv2.resize(image, new_size, interpolation=cv2.INTER_CUBIC)

    @staticmethod
    def preprocess_for_ocr(image: np.ndarray) -> np.ndarray:
        """OCR预处理流程"""
        # 1. 转灰度
        gray = ImagePreprocessor.to_gray(image)

        # 2. 增强对比度
        enhanced = ImagePreprocessor.enhance_contrast(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))

        # 3. 去噪
        denoised = ImagePreprocessor.denoise(enhanced)

        # 4. 转回灰度
        gray = ImagePreprocessor.to_gray(denoised)

        # 5. 二值化
        binary = ImagePreprocessor.binarize(gray, method='otsu')

        # 6. 放大
        resized = ImagePreprocessor.resize(binary, scale=2.0)

        return resized


class TesseractSolver:
    """Tesseract OCR识别器"""

    def __init__(self, tesseract_path: Optional[str] = None, lang: str = 'eng'):
        try:
            import pytesseract
            self.pytesseract = pytesseract

            if tesseract_path:
                self.pytesseract.pytesseract.tesseract_cmd = tesseract_path

            self.lang = lang
            self.available = True

        except ImportError:
            logger.warning("Tesseract未安装，pip install pytesseract")
            self.available = False

    async def solve(
        self,
        image: np.ndarray,
        whitelist: Optional[str] = None,
        length: Optional[int] = None
    ) -> CaptchaResult:
        """识别文本验证码"""
        if not self.available:
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="tesseract",
                error="Tesseract未安装"
            )

        start_time = asyncio.get_event_loop().time()

        try:
            # 预处理图像
            preprocessed = ImagePreprocessor.preprocess_for_ocr(image)

            # 构建配置
            config = '--psm 7 --oem 3'  # 7=单行文本, 3=默认OCR引擎

            if whitelist:
                config += f' -c tessedit_char_whitelist={whitelist}'

            # OCR识别
            pil_image = Image.fromarray(preprocessed)
            text = self.pytesseract.image_to_string(pil_image, lang=self.lang, config=config)

            # 清理结果
            result = text.strip().replace(' ', '').replace('\n', '')

            # 如果指定了长度，只返回该长度的结果
            if length and len(result) > length:
                # 尝试提取最可能的部分
                result = result[:length]

            duration = asyncio.get_event_loop().time() - start_time

            logger.info(f"Tesseract识别: {result} (耗时: {duration:.2f}s)")

            return CaptchaResult(
                success=bool(result),
                result=result,
                confidence=0.7 if result else 0.0,
                solver="tesseract",
                duration=duration
            )

        except Exception as e:
            logger.error(f"Tesseract识别失败: {e}")
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="tesseract",
                error=str(e)
            )


class DDDDOCRSolver:
    """DDDDOCR深度学习识别器"""

    def __init__(self):
        try:
            import ddddocr
            self.ocr = ddddocr.DdddOcr()
            self.available = True
        except ImportError:
            logger.warning("DDDDOCR未安装，pip install ddddocr")
            self.available = False
            self.ocr = None

    async def solve(self, image: np.ndarray) -> CaptchaResult:
        """使用DDDDOCR识别验证码"""
        if not self.available:
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="ddddocr",
                error="DDDDOCR未安装"
            )

        start_time = asyncio.get_event_loop().time()

        try:
            # 将OpenCV图像转换为bytes
            _, buffer = cv2.imencode('.png', image)
            image_bytes = buffer.tobytes()

            # 识别
            result = self.ocr.classification(image_bytes)

            duration = asyncio.get_event_loop().time() - start_time

            logger.info(f"DDDDOCR识别: {result} (耗时: {duration:.2f}s)")

            return CaptchaResult(
                success=bool(result),
                result=result,
                confidence=0.9,  # DDDDOCR通常准确率较高
                solver="ddddocr",
                duration=duration
            )

        except Exception as e:
            logger.error(f"DDDDOCR识别失败: {e}")
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="ddddocr",
                error=str(e)
            )


class EasyCaptchaSolver:
    """EasyCaptcha深度学习识别器"""

    def __init__(self):
        try:
            from_easy_captcha = __import__('from easy_captcha import Captcha')
            self.Captcha = from_easy_captcha.Captcha
            self.available = True
        except ImportError:
            logger.warning("EasyCaptcha未安装")
            self.available = False

    async def solve(self, image: np.ndarray) -> CaptchaResult:
        """使用EasyCaptcha识别"""
        if not self.available:
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="easycaptcha",
                error="EasyCaptcha未安装"
            )

        try:
            # 将OpenCV图像转换为PIL Image
            pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

            # 识别
            result = self.Captcha.identify(pil_image)

            return CaptchaResult(
                success=bool(result),
                result=result,
                confidence=0.85,
                solver="easycaptcha"
            )

        except Exception as e:
            logger.error(f"EasyCaptcha识别失败: {e}")
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="easycaptcha",
                error=str(e)
            )


class TwoCaptchaSolver:
    """2Captcha第三方打码平台"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "http://2captcha.com"
        self.available = bool(api_key)

    async def solve(self, image: np.ndarray) -> CaptchaResult:
        """使用2Captcha平台识别"""
        if not self.available:
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="2captcha",
                error="未配置API密钥"
            )

        start_time = asyncio.get_event_loop().time()

        try:
            # 转换图像为base64
            _, buffer = cv2.imencode('.png', image)
            img_base64 = base64.b64encode(buffer).decode()

            # 上传验证码
            captcha_id = await self._upload(img_base64)

            if not captcha_id:
                return CaptchaResult(
                    success=False,
                    result=None,
                    confidence=0.0,
                    solver="2captcha",
                    error="上传验证码失败"
                )

            # 轮询获取结果
            result = await self._poll_result(captcha_id)

            duration = asyncio.get_event_loop().time() - start_time

            if result:
                return CaptchaResult(
                    success=True,
                    result=result,
                    confidence=0.95,  # 人工打码准确率高
                    solver="2captcha",
                    duration=duration
                )
            else:
                return CaptchaResult(
                    success=False,
                    result=None,
                    confidence=0.0,
                    solver="2captcha",
                    error="获取结果超时"
                )

        except Exception as e:
            logger.error(f"2Captcha识别失败: {e}")
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="2captcha",
                error=str(e)
            )

    async def _upload(self, img_base64: str) -> Optional[str]:
        """上传验证码到2Captcha"""
        upload_url = f"{self.base_url}/in.php"
        params = {
            'key': self.api_key,
            'method': 'base64',
            'body': img_base64,
            'json': 1,
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(upload_url, data=params, timeout=30) as response:
                result = await response.json()

                if result.get('status') == 1:
                    return result.get('request')
                else:
                    logger.error(f"上传失败: {result.get('request')}")
                    return None

    async def _poll_result(self, captcha_id: str, max_attempts: int = 30) -> Optional[str]:
        """轮询获取识别结果"""
        get_url = f"{self.base_url}/res.php"

        for i in range(max_attempts):
            await asyncio.sleep(3)  # 每3秒查询一次

            params = {
                'key': self.api_key,
                'action': 'get',
                'id': captcha_id,
                'json': 1,
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(get_url, params=params, timeout=10) as response:
                    result = await response.json()

                    if result.get('status') == 1:
                        return result.get('request')
                    elif result.get('request') == 'CAPCHA_NOT_READY':
                        continue
                    else:
                        logger.error(f"获取结果失败: {result.get('request')}")
                        return None

        return None


class HybridCaptchaSolver:
    """混合验证码识别器 - 组合多种识别器"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.solvers = []

        # 初始化各个识别器
        # 1. Tesseract OCR
        tesseract_path = self.config.get('tesseract_path')
        if tesseract_path or True:  # 尝试使用系统默认
            self.solvers.append(TesseractSolver(tesseract_path))

        # 2. DDDDOCR
        self.solvers.append(DDDDOCRSolver())

        # 3. EasyCaptcha
        self.solvers.append(EasyCaptchaSolver())

        # 4. 2Captcha (备用)
        api_key = self.config.get('2captcha_api_key')
        if api_key:
            self.solvers.append(TwoCaptchaSolver(api_key))

    async def solve(
        self,
        image: np.ndarray,
        captcha_type: CaptchaType = CaptchaType.TEXT_IMAGE,
        **kwargs
    ) -> CaptchaResult:
        """使用混合策略识别验证码"""
        logger.info(f"开始识别验证码，类型: {captcha_type.value}")

        # 对于文本验证码，按优先级尝试各个识别器
        if captcha_type == CaptchaType.TEXT_IMAGE:
            # 优先使用深度学习识别器
            for solver in self.solvers:
                if isinstance(solver, DDDDOCRSolver) or isinstance(solver, EasyCaptchaSolver):
                    if solver.available:
                        result = await solver.solve(image)
                        if result.success:
                            return result

            # 降级到Tesseract
            for solver in self.solvers:
                if isinstance(solver, TesseractSolver) and solver.available:
                    result = await solver.solve(image, **kwargs)
                    if result.success:
                        return result

            # 最后使用第三方API
            for solver in self.solvers:
                if isinstance(solver, TwoCaptchaSolver) and solver.available:
                    logger.info("本地识别失败，使用第三方打码平台...")
                    return await solver.solve(image)

        # 其他类型的验证码（简化处理）
        return CaptchaResult(
            success=False,
            result=None,
            confidence=0.0,
            solver="hybrid",
            error=f"不支持的验证码类型: {captcha_type.value}"
        )


class CaptchaSolver:
    """验证码识别器主类"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.hybrid_solver = HybridCaptchaSolver(config)

        # 统计信息
        self.total_solved = 0
        self.total_failed = 0
        self.success_rate = 0.0

    async def solve(
        self,
        image_source: Any,
        captcha_type: CaptchaType = CaptchaType.TEXT_IMAGE,
        **kwargs
    ) -> CaptchaResult:
        """
        识别验证码

        Args:
            image_source: 图像源（文件路径、URL、bytes、np.ndarray）
            captcha_type: 验证码类型
            **kwargs: 额外参数

        Returns:
            CaptchaResult对象
        """
        try:
            # 加载图像
            image = await self._load_image(image_source)

            if image is None:
                return CaptchaResult(
                    success=False,
                    result=None,
                    confidence=0.0,
                    solver="main",
                    error="无法加载图像"
                )

            # 调用识别器
            result = await self.hybrid_solver.solve(image, captcha_type, **kwargs)

            # 更新统计
            if result.success:
                self.total_solved += 1
            else:
                self.total_failed += 1

            total = self.total_solved + self.total_failed
            if total > 0:
                self.success_rate = self.total_solved / total

            return result

        except Exception as e:
            logger.error(f"验证码识别异常: {e}")
            self.total_failed += 1
            return CaptchaResult(
                success=False,
                result=None,
                confidence=0.0,
                solver="main",
                error=str(e)
            )

    async def _load_image(self, source: Any) -> Optional[np.ndarray]:
        """加载图像"""
        # 如果是np.ndarray
        if isinstance(source, np.ndarray):
            return source

        # 如果是文件路径
        elif isinstance(source, str) and os.path.exists(source):
            image = cv2.imread(source)
            return image

        # 如果是URL
        elif isinstance(source, str) and source.startswith(('http://', 'https://')):
            try:
                response = requests.get(source, timeout=10)
                nparr = np.frombuffer(response.content, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                return image
            except Exception as e:
                logger.error(f"下载图像失败: {e}")
                return None

        # 如果是bytes
        elif isinstance(source, bytes):
            nparr = np.frombuffer(source, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return image

        # 如果是PIL Image
        elif isinstance(source, Image.Image):
            image = cv2.cvtColor(np.array(source), cv2.COLOR_RGB2BGR)
            return image

        else:
            logger.error(f"不支持的图像源类型: {type(source)}")
            return None

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            'total_solved': self.total_solved,
            'total_failed': self.total_failed,
            'success_rate': self.success_rate,
            'available_solvers': [
                s.__class__.__name__ for s in self.hybrid_solver.solvers
                if getattr(s, 'available', True)
            ]
        }


# Scrapy中间件集成
class CaptchaMiddleware:
    """Scrapy验证码处理中间件"""

    def __init__(self, settings):
        config = {
            'tesseract_path': settings.get('TESSERACT_PATH'),
            '2captcha_api_key': settings.get('TWO_CAPTCHA_API_KEY'),
        }

        self.solver = CaptchaSolver(config)
        self.auto_solve = settings.getbool('CAPTCHA_AUTO_SOLVE', True)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    async def process_response(self, request, response, spider):
        """处理响应中的验证码"""
        if self._detect_captcha(response):
            logger.warning(f"检测到验证码: {response.url}")

            if self.auto_solve:
                # 提取并识别验证码
                captcha_img = self._extract_captcha_image(response)

                if captcha_img is not None:
                    result = await self.solver.solve(
                        captcha_img,
                        CaptchaType.TEXT_IMAGE
                    )

                    if result.success:
                        logger.info(f"验证码识别成功: {result.result}")
                        # 将结果添加到请求元数据
                        request.meta['captcha_result'] = result.result
                        # 重新发送请求
                        return request

        return response

    def _detect_captcha(self, response) -> bool:
        """检测是否包含验证码"""
        # URL检查
        url_lower = response.url.lower()
        if any(kw in url_lower for kw in ['captcha', 'verify', 'validate', 'check']):
            return True

        # Content-Type检查
        content_type = response.headers.get('Content-Type', b'').decode()
        if 'image' in content_type:
            return True

        return False

    def _extract_captcha_image(self, response) -> Optional[np.ndarray]:
        """从响应中提取验证码图片"""
        content_type = response.headers.get('Content-Type', b'').decode()

        # 直接是图片
        if 'image' in content_type:
            nparr = np.frombuffer(response.body, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # TODO: 从HTML中解析img标签
        return None


# 便捷函数
async def solve_captcha(
    image_source: Any,
    config: Dict[str, Any] = None
) -> Optional[str]:
    """便捷的验证码识别函数"""
    solver = CaptchaSolver(config)
    result = await solver.solve(image_source)

    if result.success:
        return result.result
    else:
        logger.error(f"识别失败: {result.error}")
        return None


# 导入aiohttp（用于2Captcha）
try:
    import aiohttp
except ImportError:
    logger.warning("aiohttp未安装，2Captcha功能不可用")
    # 创建一个模拟的aiohttp模块
    class MockAiohttp:
        class ClientSession:
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def post(self, *args, **kwargs):
                class MockResponse:
                    async def json(self):
                        return {'status': 0}
                return MockResponse()
            async def get(self, *args, **kwargs):
                class MockResponse:
                    async def json(self):
                        return {'status': 0, 'request': 'ERROR'}
                return MockResponse()
    aiohttp = MockAiohttp()
