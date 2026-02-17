"""
AICRM System - CAPTCHA Solver
验证码识别模块，支持多种验证码类型和解决方案
"""
import io
import base64
import asyncio
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
import aiohttp
import httpx
from PIL import Image
import cv2
import numpy as np
from loguru import logger

try:
    import ddddocr
    DDDDOCR_AVAILABLE = True
except ImportError:
    DDDDOCR_AVAILABLE = False
    logger.warning("ddddocr not available, install with: pip install ddddocr")

try:
    import pytesseract
    from pytesseract import image_to_string
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not available, install with: pip install pytesseract")


class CaptchaType(Enum):
    """验证码类型"""
    TEXT_IMAGE = "text_image"  # 文本图片验证码
    RECAPTCHA_V2 = "recaptcha_v2"  # Google reCAPTCHA v2
    RECAPTCHA_V3 = "recaptcha_v3"  # Google reCAPTCHA v3
    HCAPTCHA = "hcaptcha"  # hCaptcha
    FUNCAPTCHA = "funcaptcha"  # FunCaptcha
    SLIDER = "slider"  # 滑块验证码
    POINT_CLICK = "point_click"  # 点击验证码
    GRID_SELECT = "grid_select"  # 网格选择验证码


class SolverType(Enum):
    """解决方案类型"""
    OCR = "ocr"  # 本地OCR识别
    DDDDOCR = "ddddocr"  # DDDDOCR库
    MANUAL = "manual"  # 人工打码
    API_2CAPTCHA = "2captcha"  # 2captcha服务
    API_ANTICAPTCHA = "anticaptcha"  # Anti-Captcha服务
    API_DEATHBYCAPTCHA = "deathbycaptcha"  # DeathByCaptcha服务


@dataclass
class CaptchaResult:
    """验证码识别结果"""
    success: bool
    answer: Optional[str] = None
    confidence: float = 0.0
    solver_used: Optional[SolverType] = None
    error: Optional[str] = None
    solve_time: float = 0.0


class ImagePreprocessor:
    """图像预处理器"""

    @staticmethod
    def denoise(image: Image.Image) -> Image.Image:
        """去噪"""
        img_array = np.array(image)
        denoised = cv2.fastNlMeansDenoisingColored(img_array, None, 10, 10, 7, 21)
        return Image.fromarray(denoised)

    @staticmethod
    def binarize(image: Image.Image, threshold: int = 127) -> Image.Image:
        """二值化"""
        gray = image.convert('L')
        img_array = np.array(gray)
        _, binary = cv2.threshold(img_array, threshold, 255, cv2.THRESH_BINARY)
        return Image.fromarray(binary)

    @staticmethod
    def remove_lines(image: Image.Image) -> Image.Image:
        """移除干扰线"""
        img_array = np.array(image)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

        # 使用霍夫变换检测直线
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)

        if lines is not None:
            for line in lines:
                rho, theta = line[0]
                a = np.cos(theta)
                b = np.sin(theta)
                x0 = a * rho
                y0 = b * rho
                x1 = int(x0 + 1000 * (-b))
                y1 = int(y0 + 1000 * (a))
                x2 = int(x0 - 1000 * (-b))
                y2 = int(y0 - 1000 * (a))
                cv2.line(img_array, (x1, y1), (x2, y2), (255, 255, 255), 2)

        return Image.fromarray(img_array)

    @staticmethod
    def enhance_contrast(image: Image.Image) -> Image.Image:
        """增强对比度"""
        img_array = np.array(image)
        lab = cv2.cvtColor(img_array, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
        return Image.fromarray(enhanced)

    @staticmethod
    def resize(image: Image.Image, width: int = None, height: int = None) -> Image.Image:
        """调整大小"""
        if width and height:
            return image.resize((width, height), Image.LANCZOS)
        elif width:
            ratio = width / image.width
            return image.resize((width, int(image.height * ratio)), Image.LANCZOS)
        elif height:
            ratio = height / image.height
            return image.resize((int(image.width * ratio), height), Image.LANCZOS)
        return image


class OCRSolver:
    """OCR识别器"""

    def __init__(self, tesseract_path: str = None, lang: str = "eng+chi_sim"):
        self.tesseract_path = tesseract_path
        self.lang = lang

        if TESSERACT_AVAILABLE and tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path

    async def solve(self, image: Image.Image, preprocess: bool = True) -> CaptchaResult:
        """使用OCR识别验证码"""
        if not TESSERACT_AVAILABLE:
            return CaptchaResult(
                success=False,
                error="Tesseract not available"
            )

        import time
        start_time = time.time()

        try:
            # 预处理图像
            if preprocess:
                image = ImagePreprocessor.enhance_contrast(image)
                image = ImagePreprocessor.remove_lines(image)
                image = ImagePreprocessor.binarize(image)

            # OCR识别
            config = '--psm 8 --oem 3 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            text = image_to_string(image, config=config, lang=self.lang)

            # 清理结果
            answer = text.strip().replace(' ', '').replace('\n', '')

            solve_time = time.time() - start_time

            return CaptchaResult(
                success=len(answer) > 0,
                answer=answer,
                confidence=0.7,  # OCR没有置信度，使用固定值
                solver_used=SolverType.OCR,
                solve_time=solve_time
            )

        except Exception as e:
            logger.error(f"OCR solving failed: {str(e)}")
            return CaptchaResult(
                success=False,
                error=str(e),
                solver_used=SolverType.OCR
            )


class DdddocrSolver:
    """DDDDocr识别器"""

    def __init__(self):
        if not DDDDOCR_AVAILABLE:
            raise ImportError("ddddocr not available")

        self.ocr = ddddocr.DdddOcr()

    async def solve(self, image: Image.Image) -> CaptchaResult:
        """使用DDDDocr识别验证码"""
        import time
        start_time = time.time()

        try:
            # 将PIL图像转换为字节
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_bytes = img_byte_arr.getvalue()

            # 识别
            answer = self.ocr.classification(img_bytes)

            solve_time = time.time() - start_time

            return CaptchaResult(
                success=bool(answer),
                answer=answer,
                confidence=0.8,
                solver_used=SolverType.DDDDOCR,
                solve_time=solve_time
            )

        except Exception as e:
            logger.error(f"DDDDocr solving failed: {str(e)}")
            return CaptchaResult(
                success=False,
                error=str(e),
                solver_used=SolverType.DDDDOCR
            )


class APICaptchaSolver:
    """第三方API验证码解决器"""

    def __init__(self, service: SolverType, api_key: str):
        self.service = service
        self.api_key = api_key
        self.session = None

        # API端点配置
        self.endpoints = {
            SolverType.API_2CAPTCHA: {
                "create": "http://2captcha.com/in.php",
                "result": "http://2captcha.com/res.php",
                "balance": "http://2captcha.com/res.php?action=getbalance"
            },
            SolverType.API_ANTICAPTCHA: {
                "create": "https://api.anti-captcha.com/createTask",
                "result": "https://api.anti-captcha.com/getTaskResult",
                "balance": "https://api.anti-captcha.com/getBalance"
            }
        }

    async def solve(self, image: Image.Image = None, site_key: str = None,
                    page_url: str = None, captcha_type: CaptchaType = CaptchaType.TEXT_IMAGE) -> CaptchaResult:
        """使用API解决验证码"""
        import time
        start_time = time.time()

        try:
            if captcha_type == CaptchaType.TEXT_IMAGE:
                return await self._solve_text_image(image)
            elif captcha_type in [CaptchaType.RECAPTCHA_V2, CaptchaType.HCAPTCHA]:
                return await self._solve_recaptcha(site_key, page_url, captcha_type)
            else:
                return CaptchaResult(
                    success=False,
                    error=f"Unsupported captcha type: {captcha_type}"
                )

        except Exception as e:
            logger.error(f"API solving failed: {str(e)}")
            return CaptchaResult(
                success=False,
                error=str(e),
                solver_used=self.service
            )

    async def _solve_text_image(self, image: Image.Image) -> CaptchaResult:
        """解决文本图片验证码"""
        # 转换图片为base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode()

        if self.service == SolverType.API_2CAPTCHA:
            return await self._2captcha_text(img_base64)
        elif self.service == SolverType.API_ANTICAPTCHA:
            return await self._anticaptcha_text(img_base64)

    async def _solve_recaptcha(self, site_key: str, page_url: str,
                               captcha_type: CaptchaType) -> CaptchaResult:
        """解决reCAPTCHA/hCaptcha"""
        if self.service == SolverType.API_2CAPTCHA:
            return await self._2captcha_recaptcha(site_key, page_url, captcha_type)
        elif self.service == SolverType.API_ANTICAPTCHA:
            return await self._anticaptcha_recaptcha(site_key, page_url, captcha_type)

    async def _2captcha_text(self, img_base64: str) -> CaptchaResult:
        """2captcha文本验证码"""
        params = {
            'key': self.api_key,
            'method': 'base64',
            'body': img_base64,
            'json': 1
        }

        async with httpx.AsyncClient() as client:
            # 提交验证码
            response = await client.post(self.endpoints[SolverType.API_2CAPTCHA]["create"], data=params)
            result = response.json()

            if result['status'] != 1:
                return CaptchaResult(success=False, error=result.get('request', 'Unknown error'))

            captcha_id = result['request']

            # 轮询结果
            for _ in range(30):  # 最多等待30秒
                await asyncio.sleep(2)

                params = {
                    'key': self.api_key,
                    'action': 'get',
                    'id': captcha_id,
                    'json': 1
                }

                response = await client.get(self.endpoints[SolverType.API_2CAPTCHA]["result"], params=params)
                result = response.json()

                if result['status'] == 1:
                    return CaptchaResult(
                        success=True,
                        answer=result['request'],
                        solver_used=SolverType.API_2CAPTCHA
                    )

            return CaptchaResult(success=False, error="Timeout waiting for solution")

    async def _anticaptcha_text(self, img_base64: str) -> CaptchaResult:
        """Anti-Captcha文本验证码"""
        task = {
            "clientKey": self.api_key,
            "task": {
                "type": "ImageToTextTask",
                "body": img_base64,
                "phrase": False,
                "case": False,
                "numeric": 0,
                "math": False,
                "minLength": 0,
                "maxLength": 0
            }
        }

        async with httpx.AsyncClient() as client:
            # 创建任务
            response = await client.post(self.endpoints[SolverType.API_ANTICAPTCHA]["create"], json=task)
            result = response.json()

            if result['errorId'] != 0:
                return CaptchaResult(success=False, error=result.get('errorDescription', 'Unknown error'))

            task_id = result['taskId']

            # 轮询结果
            for _ in range(30):
                await asyncio.sleep(2)

                payload = {
                    "clientKey": self.api_key,
                    "taskId": task_id
                }

                response = await client.post(self.endpoints[SolverType.API_ANTICAPTCHA]["result"], json=payload)
                result = response.json()

                if result['status'] == 'ready':
                    return CaptchaResult(
                        success=True,
                        answer=result['solution']['text'],
                        solver_used=SolverType.API_ANTICAPTCHA
                    )

            return CaptchaResult(success=False, error="Timeout waiting for solution")

    async def _2captcha_recaptcha(self, site_key: str, page_url: str,
                                  captcha_type: CaptchaType) -> CaptchaResult:
        """2captcha reCAPTCHA/hCaptcha"""
        method = 'hcaptcha' if captcha_type == CaptchaType.HCAPTCHA else 'userrecaptcha'

        params = {
            'key': self.api_key,
            'method': method,
            'googlekey': site_key,
            'pageurl': page_url,
            'json': 1
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.endpoints[SolverType.API_2CAPTCHA]["create"], data=params)
            result = response.json()

            if result['status'] != 1:
                return CaptchaResult(success=False, error=result.get('request', 'Unknown error'))

            captcha_id = result['request']

            for _ in range(60):  # reCAPTCHA可能需要更长时间
                await asyncio.sleep(3)

                params = {
                    'key': self.api_key,
                    'action': 'get',
                    'id': captcha_id,
                    'json': 1
                }

                response = await client.get(self.endpoints[SolverType.API_2CAPTCHA]["result"], params=params)
                result = response.json()

                if result['status'] == 1:
                    return CaptchaResult(
                        success=True,
                        answer=result['request'],
                        solver_used=SolverType.API_2CAPTCHA
                    )

            return CaptchaResult(success=False, error="Timeout waiting for solution")


class CaptchaSolver:
    """验证码解决器主类"""

    def __init__(self, config: Dict = None):
        self.config = config or {}

        # 初始化解决器
        self.solvers = {}

        # OCR解决器
        if self.config.get("ocr_enabled", True):
            ocr_path = self.config.get("tesseract_path")
            self.solvers[SolverType.OCR] = OCRSolver(tesseract_path=ocr_path)

        # DDDDOCR解决器
        if DDDDOCR_AVAILABLE and self.config.get("ddddocr_enabled", True):
            try:
                self.solvers[SolverType.DDDDOCR] = DdddocrSolver()
            except Exception as e:
                logger.warning(f"Failed to initialize DDDDocr: {str(e)}")

        # API解决器
        for service in [SolverType.API_2CAPTCHA, SolverType.API_ANTICAPTCHA]:
            api_key = self.config.get(f"{service.value}_api_key")
            if api_key:
                self.solvers[service] = APICaptchaSolver(service, api_key)

    async def solve(
        self,
        image: Image.Image = None,
        image_url: str = None,
        image_path: str = None,
        captcha_type: CaptchaType = CaptchaType.TEXT_IMAGE,
        preferred_solver: SolverType = None,
        site_key: str = None,
        page_url: str = None
    ) -> CaptchaResult:
        """
        解决验证码

        Args:
            image: PIL图像对象
            image_url: 图片URL
            image_path: 图片文件路径
            captcha_type: 验证码类型
            preferred_solver: 首选解决器
            site_key: reCAPTCHA站点密钥
            page_url: 页面URL

        Returns:
            CaptchaResult: 解决结果
        """
        # 加载图像
        if image_path:
            image = Image.open(image_path)
        elif image_url:
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                image = Image.open(io.BytesIO(response.content))
        elif not image:
            return CaptchaResult(success=False, error="No image source provided")

        # 选择解决器
        if preferred_solver and preferred_solver in self.solvers:
            solvers = [preferred_solver]
        else:
            # 根据验证码类型选择合适的解决器
            if captcha_type == CaptchaType.TEXT_IMAGE:
                solvers = [SolverType.DDDDOCR, SolverType.OCR]
            else:
                solvers = [SolverType.API_2CAPTCHA, SolverType.API_ANTICAPTCHA]

        # 尝试每个解决器
        for solver_type in solvers:
            if solver_type not in self.solvers:
                continue

            solver = self.solvers[solver_type]

            try:
                if captcha_type == CaptchaType.TEXT_IMAGE:
                    result = await solver.solve(image)
                else:
                    result = await solver.solve(
                        image=image,
                        site_key=site_key,
                        page_url=page_url,
                        captcha_type=captcha_type
                    )

                if result.success:
                    logger.info(f"Captcha solved using {solver_type.value}: {result.answer}")
                    return result

            except Exception as e:
                logger.warning(f"Solver {solver_type.value} failed: {str(e)}")
                continue

        return CaptchaResult(
            success=False,
            error="All solvers failed"
        )

    async def solve_from_base64(self, base64_data: str, **kwargs) -> CaptchaResult:
        """从base64数据解决验证码"""
        # 解码base64
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]

        img_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(img_bytes))

        return await self.solve(image=image, **kwargs)

    def get_available_solvers(self) -> list:
        """获取可用的解决器列表"""
        return list(self.solvers.keys())
