"""
验证码处理模块
支持多种验证码识别方式：OCR本地识别、第三方打码平台、深度学习模型
"""
import os
import base64
import io
from typing import Optional, Dict, Any
from enum import Enum
from loguru import logger
from PIL import Image
import pytesseract
import cv2
import numpy as np
import requests
from io import BytesIO


class CaptchaType(Enum):
    """验证码类型"""
    TEXT = "text"  # 文本验证码
    IMAGE = "image"  # 图像验证码
    SLIDER = "slider"  # 滑动验证码
    CLICK = "click"  # 点击验证码
    RECAPTCHA = "recaptcha"  # Google reCAPTCHA
    HCAPTCHA = "hcaptcha"  # hCaptcha


class CaptchaSolver:
    """验证码识别基类"""

    async def solve(self, image_data: bytes, **kwargs) -> Dict[str, Any]:
        """
        识别验证码

        Args:
            image_data: 验证码图片数据
            **kwargs: 其他参数

        Returns:
            Dict包含:
                - success: bool 是否成功
                - result: str 识别结果
                - confidence: float 置信度
                - solver: str 使用的识别器名称
        """
        raise NotImplementedError


class TesseractSolver(CaptchaSolver):
    """Tesseract OCR识别器"""

    def __init__(self, tesseract_path: Optional[str] = None):
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path

    async def solve(self, image_data: bytes, **kwargs) -> Dict[str, Any]:
        """使用Tesseract识别验证码"""
        try:
            # 预处理图像
            processed_image = self._preprocess_image(image_data)

            # OCR识别
            text = pytesseract.image_to_string(
                processed_image,
                config='--psm 7 --oem 3 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            )

            # 清理结果
            result = text.strip().replace(' ', '').replace('\n', '')

            logger.info(f"Tesseract识别结果: {result}")

            return {
                'success': bool(result),
                'result': result,
                'confidence': 0.7,  # Tesseract不提供置信度，使用默认值
                'solver': 'tesseract',
            }

        except Exception as e:
            logger.error(f"Tesseract识别失败: {e}")
            return {
                'success': False,
                'result': '',
                'confidence': 0.0,
                'solver': 'tesseract',
                'error': str(e),
            }

    def _preprocess_image(self, image_data: bytes) -> Image.Image:
        """预处理图像以提高识别率"""
        # 转换为OpenCV格式
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 转灰度
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 去噪
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)

        # 二值化
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # 转回PIL格式
        return Image.fromarray(binary)


class TwoCaptchaSolver(CaptchaSolver):
    """2Captcha第三方打码平台"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "http://2captcha.com"

    async def solve(self, image_data: bytes, **kwargs) -> Dict[str, Any]:
        """使用2Captcha平台识别"""
        try:
            # 上传验证码图片
            captcha_id = await self._upload_captcha(image_data)

            if not captcha_id:
                return {
                    'success': False,
                    'result': '',
                    'confidence': 0.0,
                    'solver': '2captcha',
                    'error': '上传验证码失败',
                }

            # 轮询获取结果
            result = await self._get_result(captcha_id)

            if result:
                logger.info(f"2Captcha识别结果: {result}")
                return {
                    'success': True,
                    'result': result,
                    'confidence': 0.95,  # 第三方平台准确率较高
                    'solver': '2captcha',
                }
            else:
                return {
                    'success': False,
                    'result': '',
                    'confidence': 0.0,
                    'solver': '2captcha',
                    'error': '获取识别结果超时',
                }

        except Exception as e:
            logger.error(f"2Captcha识别失败: {e}")
            return {
                'success': False,
                'result': '',
                'confidence': 0.0,
                'solver': '2captcha',
                'error': str(e),
            }

    async def _upload_captcha(self, image_data: bytes) -> Optional[str]:
        """上传验证码到2Captcha"""
        import time

        # 转换为base64
        img_base64 = base64.b64encode(image_data).decode()

        # 上传验证码
        upload_url = f"{self.base_url}/in.php"
        params = {
            'key': self.api_key,
            'method': 'base64',
            'body': img_base64,
            'json': 1,
        }

        response = requests.post(upload_url, data=params, timeout=30)
        result = response.json()

        if result['status'] == 1:
            return result['request']
        else:
            logger.error(f"上传验证码失败: {result.get('request', 'Unknown error')}")
            return None

    async def _get_result(self, captcha_id: str, max_attempts: int = 30) -> Optional[str]:
        """获取识别结果"""
        import asyncio
        import time

        get_url = f"{self.base_url}/res.php"

        for _ in range(max_attempts):
            await asyncio.sleep(3)  # 等待3秒

            params = {
                'key': self.api_key,
                'action': 'get',
                'id': captcha_id,
                'json': 1,
            }

            response = requests.get(get_url, params=params, timeout=10)
            result = response.json()

            if result['status'] == 1:
                return result['request']
            elif result['request'] == 'CAPCHA_NOT_READY':
                continue
            else:
                logger.error(f"获取结果失败: {result.get('request', 'Unknown error')}")
                return None

        return None


class HybridSolver(CaptchaSolver):
    """混合识别器 - 优先使用本地OCR，失败时使用第三方平台"""

    def __init__(
        self,
        tesseract_path: Optional[str] = None,
        two_captcha_api_key: Optional[str] = None,
    ):
        self.tesseract_solver = TesseractSolver(tesseract_path)
        self.two_captcha_solver = TwoCaptchaSolver(two_captcha_api_key) if two_captcha_api_key else None

    async def solve(self, image_data: bytes, **kwargs) -> Dict[str, Any]:
        """混合识别策略"""
        # 1. 先尝试本地OCR
        result = await self.tesseract_solver.solve(image_data, **kwargs)

        # 2. 如果本地识别失败且有第三方API，使用第三方
        if not result['success'] and self.two_captcha_solver:
            logger.info("本地OCR失败，使用2Captcha...")
            result = await self.two_captcha_solver.solve(image_data, **kwargs)

        result['solver'] = 'hybrid'
        return result


class CaptchaHandler:
    """验证码处理器 - 协调各种识别器"""

    def __init__(self, solver_type: str = "hybrid", **config):
        """
        初始化验证码处理器

        Args:
            solver_type: 识别器类型 (tesseract, 2captcha, hybrid)
            **config: 配置参数
        """
        self.solver_type = solver_type
        self.config = config

        # 根据类型创建识别器
        if solver_type == "tesseract":
            self.solver = TesseractSolver(config.get('tesseract_path'))
        elif solver_type == "2captcha":
            self.solver = TwoCaptchaSolver(config['api_key'])
        elif solver_type == "hybrid":
            self.solver = HybridSolver(
                tesseract_path=config.get('tesseract_path'),
                two_captcha_api_key=config.get('api_key'),
            )
        else:
            raise ValueError(f"不支持的识别器类型: {solver_type}")

    async def solve_captcha(
        self,
        image_source: Any,
        captcha_type: CaptchaType = CaptchaType.TEXT,
        **kwargs
    ) -> Dict[str, Any]:
        """
        识别验证码

        Args:
            image_source: 验证码图片（可以是URL、文件路径或bytes）
            captcha_type: 验证码类型
            **kwargs: 其他参数

        Returns:
            识别结果字典
        """
        try:
            # 获取图片数据
            image_data = await self._load_image(image_source)

            # 识别验证码
            result = await self.solver.solve(image_data, **kwargs)

            return result

        except Exception as e:
            logger.error(f"验证码识别异常: {e}")
            return {
                'success': False,
                'result': '',
                'confidence': 0.0,
                'solver': self.solver_type,
                'error': str(e),
            }

    async def _load_image(self, source: Any) -> bytes:
        """加载验证码图片"""
        # 如果是URL
        if isinstance(source, str) and source.startswith(('http://', 'https://')):
            response = requests.get(source, timeout=10)
            return response.content

        # 如果是文件路径
        elif isinstance(source, str) and os.path.exists(source):
            with open(source, 'rb') as f:
                return f.read()

        # 如果是bytes
        elif isinstance(source, bytes):
            return source

        # 如果是PIL Image
        elif isinstance(source, Image.Image):
            img_byte_arr = io.BytesIO()
            source.save(img_byte_arr, format='PNG')
            return img_byte_arr.getvalue()

        else:
            raise ValueError(f"不支持的图片源类型: {type(source)}")


# 便捷函数
async def solve_captcha(
    image_source: Any,
    solver_type: str = "hybrid",
    **config
) -> Optional[str]:
    """
    便捷函数：识别验证码并返回结果

    Args:
        image_source: 验证码图片
        solver_type: 识别器类型
        **config: 配置参数

    Returns:
        识别结果字符串，失败返回None
    """
    handler = CaptchaHandler(solver_type, **config)
    result = await handler.solve_captcha(image_source)

    if result['success']:
        return result['result']
    else:
        logger.error(f"验证码识别失败: {result.get('error', 'Unknown error')}")
        return None


# Scrapy中间件
class CaptchaMiddleware:
    """Scrapy验证码处理中间件"""

    def __init__(self, settings):
        solver_type = settings.get('CAPTCHA_SOLVER', 'tesseract')
        config = {
            'tesseract_path': settings.get('TESSERACT_PATH'),
            'api_key': settings.get('TWO_CAPTCHA_API_KEY'),
        }

        self.handler = CaptchaHandler(solver_type, **config)
        self.auto_solve = settings.getbool('CAPTCHA_AUTO_SOLVE', True)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    async def process_response(self, request, response, spider):
        """处理响应中的验证码"""
        # 检测是否包含验证码
        if self._detect_captcha(response):
            logger.warning(f"检测到验证码: {response.url}")

            if self.auto_solve:
                # 提取验证码图片
                captcha_img = self._extract_captcha_image(response)

                if captcha_img:
                    # 识别验证码
                    result = await self.handler.solve_captcha(captcha_img)

                    if result['success']:
                        # 重新构建请求，携带验证码结果
                        request.meta['captcha_result'] = result['result']
                        return request

        return response

    def _detect_captcha(self, response) -> bool:
        """检测响应中是否包含验证码"""
        # 简单的检测逻辑
        content_type = response.headers.get('Content-Type', b'').decode()

        # 检查URL
        if 'captcha' in response.url.lower() or 'verify' in response.url.lower():
            return True

        # 检查响应内容
        if 'image' in content_type:
            return True

        # 可以添加更多检测逻辑
        return False

    def _extract_captcha_image(self, response) -> Optional[bytes]:
        """从响应中提取验证码图片"""
        content_type = response.headers.get('Content-Type', b'').decode()

        if 'image' in content_type:
            return response.body

        # 可以添加更多提取逻辑（如从HTML中解析img标签）

        return None
