"""
浏览器指纹对抗模块
实现Canvas、WebGL等浏览器指纹随机化，防止被检测
"""
import random
import string
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger


class BrowserType(Enum):
    """浏览器类型"""
    CHROME = "chrome"
    FIREFOX = "firefox"
    SAFARI = "safari"
    EDGE = "edge"
    OPERA = "opera"


class OSType(Enum):
    """操作系统类型"""
    WINDOWS = "windows"
    MACOS = "macos"
    LINUX = "linux"
    ANDROID = "android"
    IOS = "ios"


@dataclass
class BrowserProfile:
    """浏览器配置文件"""
    browser_type: BrowserType
    os_type: OSType
    user_agent: str
    screen_resolution: str  # e.g., "1920x1080"
    viewport_size: str  # e.g., "1920x1080"
    device_pixel_ratio: float  # e.g., 1.0, 2.0
    language: str  # e.g., "zh-CN", "en-US"
    timezone: str  # e.g., "Asia/Shanghai"
    webgl_vendor: str
    webgl_renderer: str
    canvas_fingerprint: str
    audio_fingerprint: str
    fonts: List[str] = field(default_factory=list)
    plugins: List[str] = field(default_factory=list)
    hardware_concurrency: int = 4  # CPU核心数
    device_memory: int = 8  # 设备内存(GB)
    do_not_track: Optional[str] = None
    color_depth: int = 24
    pixel_depth: int = 24


class FingerprintGenerator:
    """浏览器指纹生成器"""

    # 常用的真实配置
    PROFILES = {
        BrowserType.CHROME: {
            OSType.WINDOWS: {
                'user_agents': [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                ],
                'webgl_vendor': 'Google Inc. (NVIDIA)',
                'webgl_renderer': 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
                'resolutions': ['1920x1080', '2560x1440', '1366x768', '1536x864'],
                'languages': ['zh-CN', 'en-US', 'en-GB'],
                'timezones': ['Asia/Shanghai', 'America/New_York', 'Europe/London'],
            },
            OSType.MACOS: {
                'user_agents': [
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ],
                'webgl_vendor': 'Google Inc. (Intel)',
                'webgl_renderer': 'ANGLE (Intel Iris OpenGL Engine)',
                'resolutions': ['2560x1440', '1920x1080', '1680x1050', '1440x900'],
                'languages': ['zh-CN', 'en-US', 'en-GB'],
                'timezones': ['Asia/Shanghai', 'America/Los_Angeles', 'Europe/Paris'],
            },
            OSType.LINUX: {
                'user_agents': [
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ],
                'webgl_vendor': 'Mesa',
                'webgl_renderer': 'Mesa DRI Intel(R) UHD Graphics 620 (WHL GT2)',
                'resolutions': ['1920x1080', '2560x1440', '1366x768'],
                'languages': ['en-US', 'en-GB'],
                'timezones': ['America/New_York', 'Europe/London'],
            },
        },
        BrowserType.FIREFOX: {
            OSType.WINDOWS: {
                'user_agents': [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                ],
                'webgl_vendor': 'Mozilla',
                'webgl_renderer': 'Angle (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
                'resolutions': ['1920x1080', '2560x1440', '1366x768'],
                'languages': ['zh-CN', 'en-US', 'en-GB'],
                'timezones': ['Asia/Shanghai', 'America/New_York'],
            },
            OSType.MACOS: {
                'user_agents': [
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
                ],
                'webgl_vendor': 'Mozilla',
                'webgl_renderer': 'Angle (Intel Iris OpenGL Engine)',
                'resolutions': ['2560x1440', '1920x1080', '1680x1050'],
                'languages': ['zh-CN', 'en-US'],
                'timezones': ['Asia/Shanghai', 'America/Los_Angeles'],
            },
        },
        BrowserType.SAFARI: {
            OSType.MACOS: {
                'user_agents': [
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
                ],
                'webgl_vendor': 'Apple',
                'webgl_renderer': 'Apple GPU',
                'resolutions': ['2560x1440', '1920x1080', '1680x1050'],
                'languages': ['zh-CN', 'en-US'],
                'timezones': ['Asia/Shanghai', 'America/Los_Angeles'],
            },
        },
    }

    CANVAS_NOISE_SCRIPT = """
    // Canvas指纹随机化
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
        const context = this.getContext('2d');
        if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
                imageData.data[i] = imageData.data[i] + Math.floor(Math.random() * 3) - 1;
                imageData.data[i + 1] = imageData.data[i + 1] + Math.floor(Math.random() * 3) - 1;
                imageData.data[i + 2] = imageData.data[i + 2] + Math.floor(Math.random() * 3) - 1;
            }
            context.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.apply(this, arguments);
    };
    """

    WEBGL_NOISE_SCRIPT = """
    // WebGL指纹随机化
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
            return '%WEBGL_VENDOR%';
        }
        if (parameter === 37446) {
            return '%WEBGL_RENDERER%';
        }
        return getParameter.apply(this, arguments);
    };
    """

    AUDIO_NOISE_SCRIPT = """
    // AudioContext指纹随机化
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function() {
        const result = originalGetChannelData.apply(this, arguments);
        for (let i = 0; i < result.length; i++) {
            result[i] = result[i] + Math.random() * 0.0001 - 0.00005;
        }
        return result;
    };
    """

    @classmethod
    def generate_profile(
        cls,
        browser_type: Optional[BrowserType] = None,
        os_type: Optional[OSType] = None
    ) -> BrowserProfile:
        """生成随机浏览器配置文件"""
        # 随机选择浏览器和OS
        if browser_type is None:
            browser_type = random.choice(list(BrowserType))

        if os_type is None:
            # 根据浏览器选择合适的OS
            if browser_type == BrowserType.SAFARI:
                os_type = OSType.MACOS
            else:
                os_type = random.choice([OSType.WINDOWS, OSType.MACOS, OSType.LINUX])

        # 获取对应配置
        browser_configs = cls.PROFILES.get(browser_type, {})
        os_configs = browser_configs.get(os_type, {})

        # 随机选择User-Agent
        user_agent = random.choice(os_configs.get('user_agents', [cls._get_default_ua()]))

        # 随机选择分辨率
        resolution = random.choice(os_configs.get('resolutions', ['1920x1080']))
        viewport = resolution

        # 随机选择语言
        language = random.choice(os_configs.get('languages', ['en-US']))

        # 随机选择时区
        timezone = random.choice(os_configs.get('timezones', ['America/New_York']))

        # 生成Canvas指纹
        canvas_fp = cls._generate_canvas_fingerprint()

        # 生成音频指纹
        audio_fp = cls._generate_audio_fingerprint()

        # 设置硬件信息
        hardware_concurrency = random.choice([2, 4, 6, 8, 12, 16])
        device_memory = random.choice([4, 8, 16, 32])
        device_pixel_ratio = random.choice([1.0, 2.0]) if os_type != OSType.WINDOWS else 1.0

        # 常用字体
        fonts = cls._get_common_fonts(os_type)

        # 常用插件
        plugins = cls._get_common_plugins(browser_type)

        profile = BrowserProfile(
            browser_type=browser_type,
            os_type=os_type,
            user_agent=user_agent,
            screen_resolution=resolution,
            viewport_size=viewport,
            device_pixel_ratio=device_pixel_ratio,
            language=language,
            timezone=timezone,
            webgl_vendor=os_configs.get('webgl_vendor', 'Google Inc.'),
            webgl_renderer=os_configs.get('webgl_renderer', 'ANGLE'),
            canvas_fingerprint=canvas_fp,
            audio_fingerprint=audio_fp,
            fonts=fonts,
            plugins=plugins,
            hardware_concurrency=hardware_concurrency,
            device_memory=device_memory,
            do_not_track=random.choice([None, '1', '0']),
            color_depth=24,
            pixel_depth=24,
        )

        return profile

    @staticmethod
    def _get_default_ua() -> str:
        """获取默认User-Agent"""
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    @staticmethod
    def _generate_canvas_fingerprint() -> str:
        """生成Canvas指纹"""
        # 生成一个随机但稳定的Canvas指纹
        random_part = ''.join(random.choices(string.hexdigits.lower(), k=16))
        return f"canvas:{random_part}"

    @staticmethod
    def _generate_audio_fingerprint() -> str:
        """生成音频指纹"""
        random_part = ''.join(random.choices(string.hexdigits.lower(), k=16))
        return f"audio:{random_part}"

    @staticmethod
    def _get_common_fonts(os_type: OSType) -> List[str]:
        """获取常用字体列表"""
        windows_fonts = [
            'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria',
            'Cambria Math', 'Comic Sans MS', 'Consolas', 'Courier', 'Courier New',
            'Georgia', 'Helvetica', 'Impact', 'Lucida Console', 'Microsoft Sans Serif',
            'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times', 'Times New Roman',
            'Trebuchet MS', 'Verdana', 'Monaco',
        ]

        mac_fonts = [
            'Arial', 'Arial Black', 'Arial Narrow', 'Courier', 'Courier New',
            'Georgia', 'Helvetica', 'Helvetica Neue', 'Monaco', 'Times',
            'Times New Roman', 'Verdana', 'SF Pro Display', 'SF Pro Text',
            'Menlo', 'Menlo-Regular',
        ]

        linux_fonts = [
            'Arial', 'Courier', 'Courier New', 'DejaVu Sans', 'DejaVu Serif',
            'FreeMono', 'FreeSans', 'FreeSerif', 'Liberation Mono',
            'Liberation Sans', 'Liberation Serif', 'Times', 'Ubuntu',
        ]

        if os_type == OSType.WINDOWS:
            return windows_fonts
        elif os_type == OSType.MACOS:
            return mac_fonts
        else:
            return linux_fonts

    @staticmethod
    def _get_common_plugins(browser_type: BrowserType) -> List[str]:
        """获取常用插件"""
        if browser_type == BrowserType.CHROME:
            return [
                'Chrome PDF Plugin',
                'Chrome PDF Viewer',
                'Native Client',
            ]
        elif browser_type == BrowserType.FIREFOX:
            return [
                'Firefox PDF Plugin',
            ]
        else:
            return []

    @classmethod
    def get_stealth_scripts(cls, profile: BrowserProfile) -> List[str]:
        """获取反检测脚本"""
        scripts = []

        # Canvas噪声脚本
        canvas_script = cls.CANVAS_NOISE_SCRIPT.replace('%CANVAS_FP%', profile.canvas_fingerprint)
        scripts.append(canvas_script)

        # WebGL噪声脚本
        webgl_script = cls.WEBGL_NOISE_SCRIPT.replace('%WEBGL_VENDOR%', profile.webgl_vendor)
        webgl_script = webgl_script.replace('%WEBGL_RENDERER%', profile.webgl_renderer)
        scripts.append(webgl_script)

        # 音频噪声脚本
        scripts.append(cls.AUDIO_NOISE_SCRIPT)

        # 修改Navigator对象
        navigator_script = f"""
        // 修改Navigator对象
        Object.defineProperty(navigator, 'userAgent', {{
            get: () => '{profile.user_agent}'
        }});
        Object.defineProperty(navigator, 'language', {{
            get: () => '{profile.language}'
        }});
        Object.defineProperty(navigator, 'languages', {{
            get: () => ['{profile.language}', 'en']
        }});
        Object.defineProperty(navigator, 'platform', {{
            get: () => '{profile.os_type.value}'
        }});
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {profile.hardware_concurrency}
        }});
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {profile.device_memory}
        }});
        Object.defineProperty(navigator, 'doNotTrack', {{
            get: () => {json.dumps(profile.do_not_track)}
        }});
        """
        scripts.append(navigator_script)

        # 修改Screen对象
        screen_script = f"""
        // 修改Screen对象
        const [width, height] = '{profile.screen_resolution}'.split('x');
        Object.defineProperty(screen, 'width', {{ get: () => parseInt(width) }});
        Object.defineProperty(screen, 'height', {{ get: () => parseInt(height) }});
        Object.defineProperty(screen, 'availWidth', {{ get: () => parseInt(width) }});
        Object.defineProperty(screen, 'availHeight', {{ get: () => parseInt(height) - 40 }});
        Object.defineProperty(screen, 'colorDepth', {{ get: () => {profile.color_depth} }});
        Object.defineProperty(screen, 'pixelDepth', {{ get: () => {profile.pixel_depth} }});
        """
        scripts.append(screen_script)

        # 修改Date对象（时区）
        timezone_script = f"""
        // 修改时区
        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function() {{
            // 这个需要根据实际时区计算
            return 480; // UTC+8 (Asia/Shanghai)
        }};
        """
        scripts.append(timezone_script)

        # 修改字体检测
        fonts_script = f"""
        // 字体检测保护
        const fontData = {json.dumps(profile.fonts)};
        """
        scripts.append(fonts_script)

        return scripts

    @classmethod
    def get_playwright_args(cls, profile: BrowserProfile) -> Dict[str, Any]:
        """获取Playwright浏览器启动参数"""
        return {
            'user_agent': profile.user_agent,
            'viewport': {
                'width': int(profile.viewport_size.split('x')[0]),
                'height': int(profile.viewport_size.split('x')[1]),
            },
            'locale': profile.language,
            'timezone_id': profile.timezone,
            'device_scale_factor': profile.device_pixel_ratio,
        }


class AntiDetectionManager:
    """反检测管理器"""

    def __init__(self):
        self.current_profile: Optional[BrowserProfile] = None
        self.profiles_cache: List[BrowserProfile] = []

    def generate_new_profile(self) -> BrowserProfile:
        """生成新的浏览器配置"""
        profile = FingerprintGenerator.generate_profile()
        self.current_profile = profile
        self.profiles_cache.append(profile)
        return profile

    def get_random_profile(self) -> BrowserProfile:
        """获取随机配置（从缓存中）"""
        if not self.profiles_cache:
            return self.generate_new_profile()

        return random.choice(self.profiles_cache)

    def get_current_profile(self) -> Optional[BrowserProfile]:
        """获取当前配置"""
        return self.current_profile

    async def apply_to_playwright(self, page, profile: BrowserProfile):
        """将反检测措施应用到Playwright页面"""
        # 设置视口
        width, height = map(int, profile.viewport_size.split('x'))
        await page.set_viewport_size(viewport_size={'width': width, 'height': height})

        # 注入反检测脚本
        scripts = FingerprintGenerator.get_stealth_scripts(profile)
        for script in scripts:
            await page.add_init_script(script)

        logger.info(f"已应用反检测配置: {profile.browser_type.value} on {profile.os_type.value}")

    async def apply_to_selenium(self, driver, profile: BrowserProfile):
        """将反检测措施应用到Selenium WebDriver"""
        # 设置User-Agent
        # 注意：需要在启动浏览器时通过ChromeOptions设置

        # 执行JavaScript修改navigator等对象
        scripts = FingerprintGenerator.get_stealth_scripts(profile)
        combined_script = '\n'.join(scripts)

        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': combined_script
        })

        logger.info(f"已应用反检测配置: {profile.browser_type.value} on {profile.os_type.value}")

    def get_headers(self, profile: Optional[BrowserProfile] = None) -> Dict[str, str]:
        """获取HTTP请求头"""
        if profile is None:
            profile = self.get_current_profile() or self.generate_new_profile()

        return {
            'User-Agent': profile.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': f'{profile.language},en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        }


# 全局管理器实例
_manager: Optional[AntiDetectionManager] = None


def get_anti_detection_manager() -> AntiDetectionManager:
    """获取全局反检测管理器"""
    global _manager
    if _manager is None:
        _manager = AntiDetectionManager()
    return _manager


# Scrapy中间件
class FingerprintMiddleware:
    """浏览器指纹中间件"""

    def __init__(self, settings):
        self.manager = get_anti_detection_manager()
        self.manager.generate_new_profile()

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_request(self, request, spider):
        """为请求添加反检测头"""
        profile = self.manager.get_current_profile()

        if profile:
            headers = self.manager.get_headers(profile)
            for key, value in headers.items():
                if key not in request.headers:
                    request.headers[key] = value

        return None


# 便捷函数
def generate_random_profile() -> BrowserProfile:
    """生成随机浏览器配置"""
    manager = get_anti_detection_manager()
    return manager.generate_new_profile()


def get_stealth_scripts() -> List[str]:
    """获取反检测脚本"""
    manager = get_anti_detection_manager()
    profile = manager.get_current_profile() or manager.generate_new_profile()
    return FingerprintGenerator.get_stealth_scripts(profile)
