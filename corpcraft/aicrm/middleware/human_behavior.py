"""
人类行为模拟模块
模拟真实用户的鼠标移动、滚动、点击、打字等行为
"""
import random
import asyncio
import math
from typing import Tuple, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum
from loguru import logger


class BehaviorType(Enum):
    """行为类型"""
    MOUSE_MOVE = "mouse_move"
    SCROLL = "scroll"
    CLICK = "click"
    TYPE = "type"
    HOVER = "hover"
    WAIT = "wait"


@dataclass
class Point:
    """坐标点"""
    x: float
    y: float


class MouseMovementSimulator:
    """鼠标移动模拟器"""

    @staticmethod
    def generate_bezier_path(
        start: Point,
        end: Point,
        num_points: int = 20,
        spread: float = 100
    ) -> List[Point]:
        """
        生成贝塞尔曲线路径（模拟人类鼠标移动的曲线轨迹）

        Args:
            start: 起始点
            end: 结束点
            num_points: 路径点数
            spread: 曲线扩散程度

        Returns:
            路径点列表
        """
        # 控制点（随机偏移）
        control1 = Point(
            start.x + (end.x - start.x) * 0.25 + random.uniform(-spread, spread),
            start.y + (end.y - start.y) * 0.25 + random.uniform(-spread, spread)
        )

        control2 = Point(
            start.x + (end.x - start.x) * 0.75 + random.uniform(-spread, spread),
            start.y + (end.y - start.y) * 0.75 + random.uniform(-spread, spread)
        )

        # 生成三次贝塞尔曲线
        path = []
        for i in range(num_points + 1):
            t = i / num_points
            point = MouseMovementSimulator.cubic_bezier(
                start, control1, control2, end, t
            )
            path.append(point)

        return path

    @staticmethod
    def cubic_bezier(
        p0: Point,
        p1: Point,
        p2: Point,
        p3: Point,
        t: float
    ) -> Point:
        """计算三次贝塞尔曲线上的点"""
        u = 1 - t
        tt = t * t
        uu = u * u
        uuu = uu * u
        ttt = tt * t

        x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x
        y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y

        return Point(x, y)

    @staticmethod
    def add_random_deviation(path: List[Point], max_deviation: float = 3) -> List[Point]:
        """添加随机抖动（模拟手部微小震颤）"""
        new_path = []
        for point in path:
            jitter_x = random.uniform(-max_deviation, max_deviation)
            jitter_y = random.uniform(-max_deviation, max_deviation)
            new_path.append(Point(point.x + jitter_x, point.y + jitter_y))
        return new_path

    @staticmethod
    def calculate_velocity(distance: float, min_duration: float = 0.3, max_duration: float = 1.5) -> float:
        """
        计算鼠标移动速度
        人类鼠标移动速度通常是 100-1000 像素/秒

        Args:
            distance: 移动距离（像素）
            min_duration: 最小持续时间
            max_duration: 最大持续时间

        Returns:
            移动总时间（秒）
        """
        # 速度范围（像素/秒）
        min_speed = 100
        max_speed = 800

        # 计算时间
        min_time = distance / max_speed
        max_time = distance / min_speed

        duration = max(min_time, min(min_time, max_time))
        duration = max(min_duration, min(duration, max_duration))

        return duration + random.uniform(-0.1, 0.1)  # 添加随机变化


class ScrollSimulator:
    """滚动行为模拟器"""

    @staticmethod
    def generate_scroll_sequence(
        target_scroll: int,
        current_scroll: int = 0,
        viewport_height: int = 800
    ) -> List[int]:
        """
        生成滚动序列

        Args:
            target_scroll: 目标滚动位置
            current_scroll: 当前滚动位置
            viewport_height: 视口高度

        Returns:
            滚动位置列表
        """
        sequence = []
        distance = target_scroll - current_scroll
        abs_distance = abs(distance)

        if abs_distance == 0:
            return [current_scroll]

        # 决定滚动步数
        if abs_distance <= viewport_height * 0.3:
            # 短距离：一次滚动
            steps = 1
        elif abs_distance <= viewport_height:
            # 中距离：2-3次
            steps = random.randint(2, 3)
        else:
            # 长距离：多次滚动
            steps = random.randint(3, 6)

        # 生成滚动步长
        for i in range(steps):
            # 使用缓动函数
            progress = (i + 1) / steps
            # 缓出效果
            eased_progress = 1 - pow(1 - progress, 3)

            step_distance = distance * eased_progress - sum(sequence) + current_scroll

            # 添加随机变化
            step_distance += random.uniform(-50, 50)

            if i == steps - 1:
                # 最后一步精确到达目标
                step_distance = target_scroll - (sum(sequence) + current_scroll if sequence else 0)

            sequence.append(int(step_distance))

        return sequence

    @staticmethod
    def calculate_scroll_delay(scroll_distance: int) -> float:
        """计算滚动延迟"""
        # 滚动延迟与距离相关
        base_delay = 0.1  # 基础延迟
        distance_factor = abs(scroll_distance) / 1000  # 距离因子

        delay = base_delay + distance_factor + random.uniform(0, 0.2)
        return delay


class TypingSimulator:
    """打字行为模拟器"""

    # 不同类型的打字速度（字符/秒）
    TYPING_SPEEDS = {
        'fast': 8,      # 快速打字
        'normal': 5,    # 正常打字
        'slow': 3,      # 慢速打字
    }

    # 常见错误率
    ERROR_RATES = {
        'fast': 0.05,   # 快速打字时更容易出错
        'normal': 0.02,
        'slow': 0.01,
    }

    @staticmethod
    def generate_typing_sequence(
        text: str,
        speed: str = 'normal',
        include_errors: bool = True
    ) -> List[Tuple[str, float]]:
        """
        生成打字序列

        Args:
            text: 要输入的文本
            speed: 打字速度 ('fast', 'normal', 'slow')
            include_errors: 是否包含打字错误和修正

        Returns:
            (字符, 延迟) 列表
        """
        sequence = []
        chars_per_sec = TypingSimulator.TYPING_SPEEDS.get(speed, 5)

        for i, char in enumerate(text):
            # 计算延迟
            base_delay = 1.0 / chars_per_sec

            # 添加随机变化
            delay = base_delay + random.uniform(-0.05, 0.15)
            delay = max(0.05, delay)  # 最小延迟

            # 决定是否发生错误
            error = None
            if include_errors and random.random() < TypingSimulator.ERROR_RATES.get(speed, 0.02):
                # 随机选择附近按键作为错误
                error = TypingSimulator._generate_nearby_char(char)

            if error:
                # 输入错误字符
                sequence.append((error, delay))
                # 短暂停顿（发现错误）
                sequence.append(('', 0.3))
                # 删除错误（退格）
                sequence.append(('\b', 0.1))
                # 输入正确字符
                sequence.append((char, delay * 1.5))  # 修正时稍慢
            else:
                sequence.append((char, delay))

            # 偶尔添加更长停顿（思考）
            if i > 0 and random.random() < 0.1:
                sequence.append(('', random.uniform(0.5, 1.5)))

        return sequence

    @staticmethod
    def _generate_nearby_char(char: str) -> Optional[str]:
        """生成附近按键字符（模拟打字错误）"""
        keyboard_layout = {
            'q': 'wa', 'w': 'qes', 'e': 'wrd', 'r': 'etf', 't': 'rgy',
            'y': 'tuh', 'u': 'yij', 'i': 'uok', 'o': 'ipl', 'p': 'ol',
            'a': 'qsz', 's': 'awdx', 'd': 'sfce', 'f': 'dgvr', 'g': 'fhbv',
            'h': 'gjnb', 'j': 'hkmn', 'k': 'jlm', 'l': 'k',
            'z': 'asx', 'x': 'zsdc', 'c': 'xfv', 'v': 'cfgb', 'b': 'vghn',
            'n': 'bhjm', 'm': 'njk',
        }

        char_lower = char.lower()
        if char_lower in keyboard_layout:
            nearby = keyboard_layout[char_lower]
            return random.choice(nearby)

        return None


class HumanBehaviorSimulator:
    """人类行为模拟器主类"""

    def __init__(self):
        self.mouse_simulator = MouseMovementSimulator()
        self.scroll_simulator = ScrollSimulator()
        self.typing_simulator = TypingSimulator()

    async def simulate_mouse_move(
        self,
        page,
        selector: str,
        timeout: float = 30.0
    ) -> bool:
        """
        模拟鼠标移动到元素

        Args:
            page: Playwright/Selenium页面对象
            selector: 元素选择器
            timeout: 超时时间

        Returns:
            是否成功
        """
        try:
            # 获取元素位置
            element = await page.wait_for_selector(selector, timeout=timeout * 1000)
            box = await element.bounding_box()

            if not box:
                logger.warning(f"无法获取元素位置: {selector}")
                return False

            # 获取当前鼠标位置（假设在页面中心）
            start_x = await page.evaluate('window.innerWidth') / 2
            start_y = await page.evaluate('window.innerHeight') / 2
            start = Point(start_x, start_y)

            # 目标位置（元素中心，添加随机偏移）
            end_x = box['x'] + box['width'] / 2 + random.uniform(-box['width'] * 0.2, box['width'] * 0.2)
            end_y = box['y'] + box['height'] / 2 + random.uniform(-box['height'] * 0.2, box['height'] * 0.2)
            end = Point(end_x, end_y)

            # 生成路径
            distance = math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)
            num_points = int(distance / 10)  # 每10像素一个点
            num_points = max(10, min(num_points, 50))  # 限制在10-50之间

            path = self.mouse_simulator.generate_bezier_path(start, end, num_points)
            path = self.mouse_simulator.add_random_deviation(path)

            # 计算总时间
            duration = self.mouse_simulator.calculate_velocity(distance)

            # 执行鼠标移动
            step_delay = duration / len(path)

            for i, point in enumerate(path):
                await page.mouse.move(point.x, point.y)
                await asyncio.sleep(step_delay)

                # 偶尔添加微小停顿
                if random.random() < 0.1:
                    await asyncio.sleep(random.uniform(0.05, 0.15))

            logger.debug(f"鼠标移动完成: {selector}, 耗时: {duration:.2f}s")
            return True

        except Exception as e:
            logger.error(f"鼠标移动失败: {e}")
            return False

    async def simulate_click(
        self,
        page,
        selector: str,
        move_to_element: bool = True
    ) -> bool:
        """
        模拟点击

        Args:
            page: 页面对象
            selector: 元素选择器
            move_to_element: 是否先移动到元素

        Returns:
            是否成功
        """
        try:
            if move_to_element:
                await self.simulate_mouse_move(page, selector)

            # 点击前的随机停顿（思考时间）
            await asyncio.sleep(random.uniform(0.1, 0.5))

            # 执行点击
            await page.click(selector)

            # 点击后的停顿
            await asyncio.sleep(random.uniform(0.2, 0.6))

            logger.debug(f"点击完成: {selector}")
            return True

        except Exception as e:
            logger.error(f"点击失败: {e}")
            return False

    async def simulate_scroll(
        self,
        page,
        target_position: int,
        scroll_element: Optional[str] = None
    ) -> bool:
        """
        模拟滚动

        Args:
            page: 页面对象
            target_position: 目标滚动位置
            scroll_element: 要滚动的元素选择器（None表示整个页面）

        Returns:
            是否成功
        """
        try:
            # 获取当前滚动位置
            if scroll_element:
                current_position = await page.evaluate(
                    f'document.querySelector("{scroll_element}").scrollTop'
                )
            else:
                current_position = await page.evaluate('window.scrollY')

            # 生成滚动序列
            sequence = self.scroll_simulator.generate_scroll_sequence(
                target_position,
                current_position,
                viewport_height=await page.evaluate('window.innerHeight')
            )

            # 执行滚动
            position = current_position
            for step in sequence:
                position += step

                if scroll_element:
                    await page.evaluate(
                        f'document.querySelector("{scroll_element}").scrollTop = {position}'
                    )
                else:
                    await page.evaluate(f'window.scrollTo(0, {position})')

                # 滚动延迟
                delay = self.scroll_simulator.calculate_scroll_delay(step)
                await asyncio.sleep(delay)

            logger.debug(f"滚动完成: {current_position} -> {target_position}")
            return True

        except Exception as e:
            logger.error(f"滚动失败: {e}")
            return False

    async def simulate_type(
        self,
        page,
        selector: str,
        text: str,
        speed: str = 'normal',
        clear_first: bool = True
    ) -> bool:
        """
        模拟打字

        Args:
            page: 页面对象
            selector: 输入框选择器
            text: 要输入的文本
            speed: 打字速度
            clear_first: 是否先清空输入框

        Returns:
            是否成功
        """
        try:
            # 先移动到输入框
            await self.simulate_mouse_move(page, selector)

            # 点击输入框
            await page.click(selector)

            # 清空（如果需要）
            if clear_first:
                await asyncio.sleep(random.uniform(0.1, 0.3))
                await page.fill(selector, '')
                await asyncio.sleep(random.uniform(0.1, 0.2))

            # 生成打字序列
            sequence = self.typing_simulator.generate_typing_sequence(text, speed)

            # 执行打字
            for char, delay in sequence:
                if char == '\b':
                    # 退格
                    await page.keyboard.press('Backspace')
                elif char:
                    # 输入字符
                    await page.keyboard.type(char)

                if delay > 0:
                    await asyncio.sleep(delay)

            logger.debug(f"打字完成: {selector}, 文本: {text}")
            return True

        except Exception as e:
            logger.error(f"打字失败: {e}")
            return False

    async def simulate_human_behavior_sequence(
        self,
        page,
        actions: List[Tuple[str, dict]]
    ) -> bool:
        """
        执行一系列人类行为

        Args:
            page: 页面对象
            actions: 动作列表，每个动作是 (类型, 参数) 元组
                    例如: [('click', {'selector': '#btn'}), ('type', {'selector': '#input', 'text': 'hello'})]

        Returns:
            是否全部成功
        """
        all_success = True

        for action_type, params in actions:
            try:
                if action_type == 'move':
                    await self.simulate_mouse_move(page, params['selector'])
                elif action_type == 'click':
                    await self.simulate_click(page, params['selector'])
                elif action_type == 'scroll':
                    await self.simulate_scroll(page, params['position'])
                elif action_type == 'type':
                    await self.simulate_type(
                        page,
                        params['selector'],
                        params['text'],
                        params.get('speed', 'normal')
                    )
                elif action_type == 'wait':
                    await asyncio.sleep(params['duration'])
                else:
                    logger.warning(f"未知动作类型: {action_type}")

                # 动作之间的随机停顿
                await asyncio.sleep(random.uniform(0.3, 1.0))

            except Exception as e:
                logger.error(f"执行动作失败 ({action_type}): {e}")
                all_success = False

        return all_success


# 全局实例
_simulator: Optional[HumanBehaviorSimulator] = None


def get_behavior_simulator() -> HumanBehaviorSimulator:
    """获取全局行为模拟器"""
    global _simulator
    if _simulator is None:
        _simulator = HumanBehaviorSimulator()
    return _simulator


# 便捷函数
async def simulate_human_interaction(
    page,
    selector: str,
    action: str = 'click'
) -> bool:
    """便捷的人类交互模拟函数"""
    simulator = get_behavior_simulator()

    if action == 'click':
        return await simulator.simulate_click(page, selector)
    elif action == 'type':
        return await simulator.simulate_type(page, selector, '')
    elif action == 'hover':
        return await simulator.simulate_mouse_move(page, selector)
    else:
        logger.error(f"未知交互类型: {action}")
        return False
