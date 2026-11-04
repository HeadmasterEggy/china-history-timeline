"""生成疆域演变地图数据 data/map/borders.json。

数据来源：historical-basemaps（https://github.com/aourednik/historical-basemaps，GPL-3.0）。
原始数据中东亚部分存在命名错误（如 700 年仍标为 "Sui Empire"、1200 年北方仍标为 "Liao"），
因此每一帧的政权归属和中文名称都由下方 FRAMES 配置人工指定，不直接使用原始名称。
现代国界（1912 年以后）不在此绘制，页面中引导读者查阅国家标准地图。

部分年份的边界有明显史实错误（如 1200 年南宋仍据有华北），由 FRAMES 中的 fix 按分界线校正。

用法（需要 shapely：pip install -r scripts/requirements.txt）：
    python3 scripts/build_map.py <historical-basemaps 的 geojson 目录>
"""

import json
import math
import os
import sys

# ---------- 投影与输出范围 ----------
LON0, LON1 = 73.0, 136.0
LAT0, LAT1 = 16.0, 54.0
WIDTH = 1000.0
SIMPLIFY_PX = 1.4      # 简化容差（像素）
MIN_RING_PX2 = 6.0     # 小于该面积的碎片丢弃
LABEL_MIN_PX2 = 900.0  # 面积足够大才显示标签
LABEL_MIN_REGIME_PX2 = 120.0  # 本站收录政权的标签阈值更低（如荆南）


def merc(lat):
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


SCALE = WIDTH / (LON1 - LON0)
HEIGHT = SCALE * (merc(LAT1) - merc(LAT0))


def project(lon, lat):
    lat = max(-80.0, min(80.0, lat))
    return ((lon - LON0) * SCALE, (merc(LAT1) - merc(lat)) * SCALE)


# ---------- 史实校正 ----------
# 原始数据在部分年份沿用了更早的边界。以下折线（经度, 纬度）为近似的南北分界，
# 线以北的部分从前者划归后者。
HUAI_1200 = [(98, 34.0), (103, 34.0), (106.9, 34.35), (110, 33.2), (112.5, 32.6), (114.5, 32.4),
             (116.5, 32.6), (118.5, 33.3), (121.5, 34.0), (124, 34.0)]   # 宋金：淮河—大散关
HUAI_500 = [(98, 33.5), (103, 33.5), (107, 33.3), (110, 33.0), (112.5, 32.5), (114.5, 32.3),
            (116.5, 32.4), (118.5, 33.0), (121.5, 33.8), (124, 33.8)]    # 齐魏：北魏 469 年取青齐、500 年取寿春
JIN_400 = [(98, 33.0), (103, 33.0), (110, 33.3), (113, 33.8), (116.5, 34.3), (118.5, 34.6),
           (121.5, 35.2), (124, 35.2)]                                    # 东晋：洛阳 399 年失于后秦，青齐属南燕


def north_of(line, top=56):
    """由分界折线向北围成的多边形（经纬度）。"""
    return line + [(line[-1][0], top), (line[0][0], top)]


# 三国（约 230 年）：原始数据无此时期，由 200 年的汉朝范围按近似疆界切分。
# 蜀汉：益州（含汉中、南中），以秦岭、巫山与魏、吴分界；
# 孙吴：江东、荆州南部与交州，与魏大致以江淮之间（合肥、襄阳以南）为界。
SHU_230 = [(95, 21.5), (95, 34), (104.5, 33.8), (106.5, 33.6), (108.5, 33.2), (110.2, 31.5),
           (110.2, 29), (109, 27), (106.5, 25), (105, 23), (103, 21.5)]
WU_230 = [(110.2, 31.5), (111.5, 31.4), (112.3, 31.7), (114, 31.5), (116, 31.6), (117.6, 31.5),
          (119, 32.2), (121.5, 32.5), (124, 32.5), (124, 15), (103, 15), (103, 21.5), (105, 23),
          (106.5, 25), (109, 27), (110.2, 29)]


# 五代十国（943 年，后晋天福八年）：原始数据无此时期，由 900 年的唐朝范围切分。
# 燕云十六州（938 年割让）与辽东归辽；南方七国：南唐、吴越、闽、楚、南汉、后蜀、荆南。
YANYUN_943 = [(104, 40.5), (110.5, 39.6), (112.0, 39.0), (113.5, 39.0), (115.0, 38.9),
              (116.3, 38.4), (117.5, 38.6), (119.0, 39.2), (122.0, 38.5), (127.0, 38.5)]
HEXI_943 = [(85, 35.5), (85, 45), (104.5, 45), (104.5, 37.5), (103, 35.5)]
JIAOZHI_943 = [(100, 15), (100, 23.3), (104, 23.0), (106.5, 22.8), (108.2, 21.5), (110, 15)]
HOUSHU_943 = [(101.5, 27.5), (102, 33.5), (104.5, 34.8), (106.5, 34.6), (107.5, 33.6), (108.8, 33.0),
              (110.0, 31.8), (109.5, 29.5), (107.0, 28.5), (105.0, 27.8), (103.5, 26.5)]
JINGNAN_943 = [(111.0, 29.9), (111.0, 31.2), (112.8, 31.2), (112.8, 29.8)]
WUYUE_943 = [(118.5, 28.3), (118.5, 30.3), (119.3, 31.3), (120.0, 31.6), (121.5, 31.7),
             (122.8, 30.8), (122.0, 28.5), (120.6, 27.3)]
MIN_943 = [(116.0, 24.8), (116.5, 26.0), (117.5, 28.3), (118.5, 28.3), (120.6, 27.3),
           (121.0, 26.0), (119.8, 25.0), (118.0, 23.3), (117.0, 23.3)]
NANTANG_943 = [(113.9, 30.6), (114.2, 29.4), (113.8, 25.6), (114.5, 24.7), (116.0, 24.8), (116.5, 26.0),
               (117.5, 28.3), (118.5, 28.3), (118.5, 30.3), (119.3, 31.3), (120.0, 31.6), (121.5, 31.7),
               (122.0, 33.8), (119.2, 33.6), (117.5, 33.0), (116.0, 32.5), (114.8, 32.2)]
CHU_943 = [(108.8, 27.0), (109.5, 28.5), (110.0, 29.8), (112.6, 29.8), (114.2, 29.4), (113.8, 25.6),
           (112.5, 24.6), (110.5, 24.4), (108.5, 25.0)]
NANHAN_943 = [(102, 24.5), (106, 24.5), (108.5, 25.2), (110.5, 24.6), (112.5, 24.6), (113.8, 25.4),
              (114.6, 24.7), (116.0, 24.8), (117.2, 23.6), (118.5, 22), (118.5, 15), (102, 15)]
SOUTH_REST_943 = [(95, 15), (95, 29.0), (125, 29.0), (125, 15)]   # 其余南方山地，多为羁縻部族


# 北齐、北周与陈（约 565 年）：由 600 年的隋朝范围切分。
# 长城以北属突厥，辽河以东属高句丽；北周据关中、巴蜀、江陵以北，北齐据关东、淮南，陈退守长江以南。
NORTH_565 = [(95, 40.0), (104, 39.5), (106.5, 38.8), (108.5, 38.5), (110.8, 39.5), (112.5, 40.3),
             (115, 40.8), (118, 40.6), (120.5, 41.5), (124, 42.0)]
LIAODONG_565 = [(121.8, 38.5), (121.9, 40.8), (122.4, 42.0), (123.2, 44.5), (130, 44.5), (130, 38)]
XILIANG_565 = [(111.0, 29.9), (111.0, 31.0), (112.6, 31.0), (112.6, 29.9)]
BEIZHOU_565 = [(90, 15), (90, 45), (110.8, 45), (110.8, 41), (110.5, 39.5), (110.5, 36), (110.8, 35),
               (111.8, 34.6), (112.2, 33.6), (113.0, 32.6), (114.3, 31.2), (114.3, 30.75), (112.8, 30.2),
               (111.5, 30.0), (110.0, 29.5), (108.5, 28.0), (106, 26), (103, 24), (100, 15)]
CHEN_565 = [(110.0, 29.5), (111.5, 30.0), (112.8, 30.2), (114.3, 30.75), (116, 29.85), (117, 30.6),
            (118.4, 31.45), (118.8, 32.2), (119.4, 32.3), (121.0, 32.0), (124, 31.8), (124, 10), (100, 10),
            (103, 24), (106, 26), (108.5, 28.0)]

# 明末（约 1640 年）：由 1600 年的明朝范围切分。原始数据把东北和漠南都算作明朝，
# 这里以长城与宁锦防线为界：关外辽东（含辽东半岛）与漠南蒙古归后金（1636 年改国号清）。
QING_1640 = [(104, 56), (140, 56), (140, 38.0), (121.0, 38.0), (121.9, 40.8), (121.3, 41.35), (120.5, 40.9),
             (119.8, 40.15), (118.4, 40.4), (117.2, 40.7), (116.0, 40.35), (114.9, 40.9), (113.3, 40.4),
             (111.5, 39.4), (109.7, 38.3), (106.3, 38.5), (104, 38.0)]
MONGOL_W_1640 = [(85, 56), (104, 56), (104, 38.0), (102.6, 37.9), (98.2, 39.8), (95, 40.5), (85, 41)]


# 秦（约前 210 年）：由前 200 年的汉朝范围补全。秦南平百越设南海、桂林、象郡，并设闽中郡。
HAINAN = [(108.4, 17.8), (108.4, 20.25), (111.3, 20.25), (111.3, 17.8)]  # 海南岛：前 110 年才设珠崖、儋耳郡
LINGNAN_210 = [(104, 20.5), (104, 26.2), (111.5, 26.3), (116.5, 25.5), (117.5, 23), (110, 19.5)]

# 安史之乱（756 年）：由 700 年的唐朝范围切分出叛军（大燕）控制的河北、河南与两京一带。
YAN_756 = [(107.8, 33.9), (107.8, 35.0), (110.5, 35.0), (112.5, 35.1), (113.6, 35.3), (113.8, 37.0),
           (114.2, 38.5), (114.8, 39.8), (115.2, 40.8), (117.5, 41.5), (120.5, 41.8), (121.5, 41.0),
           (121.5, 38.8), (118.0, 38.5), (117.0, 37.0), (116.5, 35.5), (116.0, 34.5), (115.2, 34.0),
           (113.5, 33.6), (111.0, 33.8)]


# ---------- 帧配置 ----------
# role: main = 中原王朝；para = 并存政权（本站收录）；adm = 王朝管辖或羁縻区域；other = 周边政权
# 每项：数据集名称 -> (role, 本站朝代 id 或 None, 中文标签[, 标签位置 (经度, 纬度)])
FRAMES = [
    {"src": "bc2000", "year": -2000, "title": "夏", "focus": "xia",
     "desc": "夏朝活动中心在今河南西部、山西南部的伊洛河与汾河下游一带。",
     "map": {"Xia": ("main", "xia", "夏")}},
    {"src": "bc1500", "year": -1500, "title": "商", "focus": "shang",
     "desc": "商朝以黄河中下游为中心，势力南及长江流域，周边分布着众多方国部族。",
     "map": {"Zhoa": ("main", "shang", "商"), "Wu": ("other", None, "吴越先民")}},
    {"src": "bc1000", "year": -1000, "title": "西周", "focus": "xizhou",
     "desc": "西周实行分封，诸侯国从关中、中原延伸到山东、燕山和江汉地区。",
     "map": {"Zhoa": ("main", "xizhou", "西周"), "Wu": ("other", None, "吴越")}},
    {"src": "bc700", "year": -700, "title": "春秋初期", "focus": "chunqiu",
     "desc": "周王室东迁洛邑，诸侯并起，齐、晋、楚、秦等大国开始争霸。",
     "map": {"Zhoa": ("main", "chunqiu", "周王室与诸侯"), "Wu": ("para", "chunqiu", "吴")}},
    {"src": "bc500", "year": -500, "title": "春秋末期", "focus": "chunqiu",
     "desc": "吴、越在东南崛起，华夏诸侯的范围扩展到长江下游。",
     "map": {"Zhou states": ("main", "chunqiu", "春秋诸国")}},
    {"src": "bc400", "year": -400, "title": "战国初期", "focus": "zhanguo",
     "desc": "三家分晋后战国七雄并立，北方草原有东胡、匈奴等部族。",
     "map": {"Zhou states": ("main", "zhanguo", "战国七雄")}},
    {"src": "bc300", "year": -300, "title": "战国后期", "focus": "zhanguo",
     "desc": "秦国吞并巴蜀，实力跃居七国之首，统一之势已成。",
     "map": {"Qin": ("main", "zhanguo", "秦"), "Zhou states": ("main", "zhanguo", "关东六国"),
             "Yue": ("other", None, "越")}},
    {"src": "bc200", "year": -210, "title": "秦统一", "focus": "qin",
     "desc": "秦灭六国后南平百越，设南海、桂林、象郡和闽中郡；北逐匈奴收复河套，连接各国长城，形成统一的多民族国家。",
     "map": {"Han Empire": ("main", "qin", "秦"), "Xiongnu": ("other", None, "匈奴"),
             "Yuezhi": ("other", None, "月氏")},
     "merge": [("Nan-Yue", "Han Empire"), ("Min-Yue", "Han Empire")],
     "move": [("Thai", "Han Empire", LINGNAN_210)],
     "split": [("Han Empire", "海南岛", HAINAN)]},
    {"src": "bc200", "year": -200, "title": "西汉初年", "focus": "xihan",
     "desc": "汉朝初建，北有匈奴冒顿单于强盛，南有南越、闽越割据。",
     "map": {"Han Empire": ("main", "xihan", "西汉"), "Nan-Yue": ("other", None, "南越"),
             "Min-Yue": ("other", None, "闽越"), "海南岛": ("other", None, "")},
     "split": [("Han Empire", "海南岛", HAINAN)]},
    {"src": "bc100", "year": -100, "title": "汉武帝时期", "focus": "xihan",
     "desc": "汉武帝北击匈奴，开河西四郡，平定南越、闽越，疆域大为扩展。",
     "map": {"Han Empire": ("main", "xihan", "西汉")}},
    {"src": "bc1", "year": -1, "title": "西汉末年", "focus": "xihan",
     "desc": "西域都护府设立后，西域诸国归属汉朝管辖。",
     "map": {"Han": ("main", "xihan", "西汉"), "Hainan": ("other", None, "海南")}},
    {"src": "100", "year": 100, "title": "东汉", "focus": "donghan",
     "desc": "班超经营西域三十年，东汉重新控制西域。南匈奴内附。",
     "map": {"Han": ("main", "donghan", "东汉"), "Southern Xiongnu": ("other", None, "南匈奴"),
             "Hainan": ("other", None, "海南")}},
    {"src": "200", "year": 230, "title": "三国", "focus": "wei",
     "desc": "魏、蜀、吴三国鼎立：曹魏据有中原和北方，蜀汉据有益州，孙吴据有江东、荆南与交州。",
     "map": {"Han": ("main", "wei", "魏"), "蜀汉": ("para", "shu", "蜀"), "孙吴": ("para", "wu", "吴"),
             "Southern Xiongnu": ("other", None, "南匈奴"), "Hainan": ("other", None, "")},
     "split": [("Han", "蜀汉", SHU_230), ("Han", "孙吴", WU_230)]},
    {"src": "300", "year": 300, "title": "西晋", "focus": "xijin",
     "desc": "西晋短暂统一，八王之乱期间内迁各族势力渐强。",
     "map": {"Jin": ("main", "xijin", "西晋"), "Han Zhao": ("other", None, "匈奴五部"),
             "Hainan": ("main", "xijin", "")}},
    {"src": "400", "year": 400, "title": "东晋十六国", "focus": "dongjin",
     "desc": "晋室南渡，以淮河、秦岭一线与北方十六国对峙。",
     "map": {"Jin": ("main", "dongjin", "东晋"), "Sixteen Kingdoms": ("para", "shiliuguo", "十六国"),
             "Northern Liang": ("para", "shiliuguo", "北凉"), "Hainan": ("main", "dongjin", "")},
     "fix": [("Jin", "Sixteen Kingdoms", JIN_400)]},
    {"src": "500", "year": 500, "title": "南北朝", "focus": "beiwei",
     "desc": "北魏统一北方并迁都洛阳，与南朝（此时为南齐）隔淮对峙。",
     "map": {"Toba Wei": ("para", "beiwei", "北魏"), "Jin Empire": ("main", "nqi", "南齐")},
     "fix": [("Jin Empire", "Toba Wei", HUAI_500)]},
    {"src": "600", "year": 565, "title": "北齐、北周与陈", "focus": "nchen",
     "desc": "北方分裂为东边的北齐与西边的北周，南方的陈退守长江以南；江陵有北周扶植的西梁，北方草原突厥强盛。",
     "map": {"Sui Empire": ("para", "beiqi", "北齐"), "北周": ("para", "beizhou", "北周"),
             "陈": ("main", "nchen", "陈"), "西梁": ("other", None, "西梁"),
             "Göktürks": ("other", None, "突厥"), "Koguryo": ("other", None, "高句丽")},
     "fix": [("Sui Empire", "Göktürks", NORTH_565)],
     "split": [("Sui Empire", "高句丽辽东", LIAODONG_565), ("Sui Empire", "西梁", XILIANG_565),
               ("Sui Empire", "北周", BEIZHOU_565), ("Sui Empire", "陈", CHEN_565)],
     "merge_after": [("高句丽辽东", "Koguryo")]},
    {"src": "600", "year": 600, "title": "隋", "focus": "sui",
     "desc": "隋朝结束南北分裂，北方突厥分裂为东西两部。",
     "map": {"Sui Empire": ("main", "sui", "隋")}},
    {"src": "700", "year": 700, "title": "唐前期", "focus": "tang",
     "desc": "唐朝击败东、西突厥，设安西、北庭等都护府，青藏高原上吐蕃兴起。",
     "map": {"Sui Empire": ("main", "tang", "唐"), "Tufan Empire": ("para", "tubo", "吐蕃"),
             "Nan-Zhao": ("other", None, "六诏"), "Hainan": ("main", "tang", "")}},
    {"src": "700", "year": 756, "title": "安史之乱", "focus": "yan",
     "desc": "755 年安禄山起兵，次年在洛阳称帝，攻破潼关占领长安；唐玄宗逃往蜀中，太子李亨在灵武即位，借回纥兵平叛。",
     "map": {"Sui Empire": ("main", "tang", "唐"), "大燕": ("para", "yan", "大燕（安史叛军）"),
             "Tufan Empire": ("para", "tubo", "吐蕃"), "Nan-Zhao": ("para", "nanzhao", "南诏"),
             "Göktürks": ("other", None, ""), "Uyghurs": ("other", None, "回纥"), "Koguryo": ("other", None, ""),
             "Paekche": ("other", None, ""), "Hainan": ("main", "tang", "")},
     "split": [("Sui Empire", "大燕", YAN_756)]},
    {"src": "800", "year": 800, "title": "唐中后期", "focus": "tang",
     "desc": "安史之乱后唐朝退出西域，吐蕃占据河西陇右，回鹘称雄漠北。",
     "map": {"Tang Empire": ("main", "tang", "唐"), "Tibetan Empire": ("para", "tubo", "吐蕃"),
             "Nan Chao": ("para", "nanzhao", "南诏"), "Parhae": ("para", "bohai", "渤海"),
             "Hainan": ("main", "tang", "")}},
    {"src": "900", "year": 900, "title": "唐末", "focus": "tang",
     "desc": "唐朝藩镇割据，契丹在辽河流域崛起，吐蕃已经分裂。",
     "map": {"Tang Empire": ("main", "tang", "唐"), "Nan Chao": ("para", "nanzhao", "南诏"),
             "Balhae": ("para", "bohai", "渤海"), "Tibetan Empire": ("other", None, "吐蕃诸部"),
             "Hainan": ("main", "tang", "")}},
    {"src": "900", "year": 943, "title": "五代十国", "focus": "houjin",
     "desc": "后晋割让燕云十六州给契丹（辽），北方门户洞开；南方七国分立，经济文化持续发展。",
     "map": {"Tang Empire": ("main", "houjin", "后晋"), "Khitans": ("para", "liao", "辽"),
             "Nan Chao": ("para", "dali", "大理"), "Tibetan Empire": ("other", None, "吐蕃诸部"),
             "Hainan": ("para", "shiguo", ""), "河西诸部": ("other", None, "河西诸部"),
             "交趾": ("other", None, "交趾（吴权）"), "后蜀": ("para", "shiguo", "后蜀"),
             "荆南": ("para", "shiguo", "荆南"), "吴越": ("para", "shiguo", "吴越"), "闽": ("para", "shiguo", "闽", (118.4, 26.4)),
             "南唐": ("para", "shiguo", "南唐", (116.2, 29.2)), "楚": ("para", "shiguo", "楚", (111.4, 27.0)),
             "南汉": ("para", "shiguo", "南汉", (110.6, 23.3)),
             "羁縻诸部": ("other", None, ""), "Silla": ("other", None, "高丽")},
     "merge": [("Balhae", "Khitans")],
     "fix": [("Tang Empire", "Khitans", YANYUN_943)],
     "split": [("Tang Empire", "河西诸部", HEXI_943), ("Tang Empire", "交趾", JIAOZHI_943),
               ("Tang Empire", "后蜀", HOUSHU_943), ("Tang Empire", "荆南", JINGNAN_943),
               ("Tang Empire", "吴越", WUYUE_943), ("Tang Empire", "闽", MIN_943),
               ("Tang Empire", "南唐", NANTANG_943), ("Tang Empire", "楚", CHU_943),
               ("Tang Empire", "南汉", NANHAN_943), ("Tang Empire", "羁縻诸部", SOUTH_REST_943)]},
    {"src": "1000", "year": 1000, "title": "北宋与辽", "focus": "beisong",
     "desc": "澶渊之盟前后，宋辽南北并立，党项、大理分据西北和西南。",
     "map": {"Song Empire": ("main", "beisong", "北宋"), "Liao": ("para", "liao", "辽"),
             "Xixia": ("para", "xixia", "党项（西夏）"), "Nan Chao": ("para", "dali", "大理"),
             "Tibet": ("other", None, "吐蕃诸部"), "Hainan": ("main", "beisong", "")}},
    {"src": "1100", "year": 1100, "title": "北宋、辽、西夏", "focus": "beisong",
     "desc": "宋、辽、西夏三足鼎立，东北女真即将崛起。",
     "map": {"Song Empire": ("main", "beisong", "北宋"), "Liao": ("para", "liao", "辽"),
             "Xixia": ("para", "xixia", "西夏"), "Nan Chao": ("para", "dali", "大理"),
             "Tibet": ("other", None, "吐蕃诸部"), "Hainan": ("main", "beisong", "")}},
    {"src": "1200", "year": 1200, "title": "南宋与金", "focus": "nansong",
     "desc": "南宋与金以淮河—大散关为界，漠北蒙古各部即将统一。",
     "map": {"Song Empire": ("main", "nansong", "南宋"), "Liao": ("para", "jin", "金"),
             "Xixia": ("para", "xixia", "西夏"), "Nan Chao": ("para", "dali", "大理"),
             "Kara Khitai Khaganate": ("other", None, "西辽"), "Tibet": ("other", None, "吐蕃诸部"),
             "Hainan": ("main", "nansong", "")},
     "fix": [("Song Empire", "Liao", HUAI_1200)]},
    {"src": "1279", "year": 1279, "title": "元", "focus": "yuan",
     "desc": "元朝灭南宋，疆域空前辽阔；设宣政院管辖吐蕃地区。",
     "map": {"Great Khanate": ("main", "yuan", "元"), "Tibet": ("adm", "yuan", "宣政院辖地"),
             "Hainan": ("main", "yuan", "")}},
    {"src": "1500", "year": 1500, "title": "明", "focus": "ming",
     "desc": "明朝北筑长城防御蒙古（鞑靼、瓦剌），西南设乌思藏都司等羁縻机构。",
     "map": {"Ming Chinese Empire": ("main", "ming", "明"), "Tibet": ("adm", "ming", "乌思藏（羁縻）"),
             "Taiwan": ("other", None, "台湾")}},
    {"src": "1600", "year": 1600, "title": "明后期", "focus": "ming",
     "desc": "万历年间明朝援朝抗倭，东北女真各部逐渐统一。",
     "map": {"Ming Chinese Empire": ("main", "ming", "明"), "Tibet": ("adm", "ming", "乌思藏（羁縻）")}},
    {"src": "1600", "year": 1640, "title": "明末与后金（清）", "focus": "houjin2",
     "desc": "1636 年皇太极改国号为清，据有辽东与漠南蒙古；明朝凭山海关—宁锦防线抵御，关内李自成、张献忠起义已席卷中原。",
     "map": {"Ming Chinese Empire": ("main", "ming", "明"), "后金": ("para", "houjin2", "后金（清）"),
             "蒙古诸部": ("other", None, "蒙古诸部"), "Tibet": ("adm", "ming", "乌思藏（羁縻）"),
             "Korea": ("other", None, "朝鲜")},
     "split": [("Ming Chinese Empire", "后金", QING_1640), ("Ming Chinese Empire", "蒙古诸部", MONGOL_W_1640)]},
    {"src": "1650", "year": 1650, "title": "清初", "focus": "qing",
     "desc": "清军入关，南明政权在西南抗清；台湾仍为荷兰殖民者占据。",
     "map": {"Manchu Empire": ("main", "qing", "清"), "Post-Ming Warlords": ("para", "nanming", "南明"),
             "Dutch Formosa": ("other", None, "荷据台湾"), "Hong Kong": ("main", "qing", ""),
             "Tibet": ("other", None, "卫藏（和硕特汗国）")}},
    {"src": "1800", "year": 1800, "title": "清中期", "focus": "qing",
     "desc": "乾隆年间平定准噶尔、大小和卓，清朝疆域达到鼎盛。",
     "map": {"Qing Empire": ("main", "qing", "清"), "Hong Kong": ("main", "qing", "")}},
    {"src": "1900", "year": 1900, "title": "清末", "focus": "qing",
     "desc": "鸦片战争后，清朝被迫割让香港岛、台湾等地，北方大片领土被沙俄侵占。",
     "map": {"Manchu Empire": ("main", "qing", "清")}},
]

# 各帧都城（名称, 经度, 纬度），第一个为该时期中原王朝的都城
CAPITALS = {
    -2000: [("阳城（传说）", 113.05, 34.45)],
    -1500: [("亳（今郑州）", 113.67, 34.75)],
    -1000: [("镐京", 108.78, 34.23), ("成周洛邑", 112.45, 34.62)],
    -700: [("洛邑", 112.45, 34.62)],
    -500: [("洛邑", 112.45, 34.62)],
    -400: [("洛邑", 112.45, 34.62), ("临淄", 118.35, 36.85), ("郢", 112.2, 30.4), ("安邑", 111.1, 35.1)],
    -300: [("咸阳", 108.7, 34.35), ("临淄", 118.35, 36.85), ("郢", 112.2, 30.4), ("邯郸", 114.5, 36.6), ("大梁", 114.35, 34.8), ("新郑", 113.7, 34.4), ("蓟", 116.35, 39.9)],
    -210: [("咸阳", 108.7, 34.35)],
    -200: [("长安", 108.88, 34.3), ("番禺", 113.26, 23.13)],
    -100: [("长安", 108.88, 34.3)],
    -1: [("长安", 108.88, 34.3)],
    100: [("洛阳", 112.62, 34.72)],
    230: [("洛阳", 112.62, 34.72), ("成都", 104.06, 30.67), ("建业", 118.78, 32.05)],
    300: [("洛阳", 112.62, 34.72)],
    400: [("建康", 118.78, 32.05), ("姑臧", 102.64, 37.93)],
    500: [("建康", 118.78, 32.05), ("洛阳", 112.62, 34.72)],
    565: [("建康", 118.78, 32.05), ("邺城", 114.37, 36.33), ("长安", 108.94, 34.27), ("江陵", 112.2, 30.35)],
    600: [("大兴", 108.94, 34.27)],
    700: [("长安", 108.94, 34.27), ("神都洛阳", 112.45, 34.62), ("逻些", 91.13, 29.65)],
    756: [("灵武（肃宗即位）", 106.33, 38.1), ("洛阳（大燕）", 112.45, 34.62), ("成都（玄宗入蜀）", 104.06, 30.67), ("逻些", 91.13, 29.65)],
    800: [("长安", 108.94, 34.27), ("逻些", 91.13, 29.65), ("羊苴咩城", 100.16, 25.69), ("上京龙泉府", 129.1, 43.97)],
    900: [("长安", 108.94, 34.27), ("羊苴咩城", 100.16, 25.69), ("上京龙泉府", 129.1, 43.97)],
    943: [("东京开封", 114.35, 34.79), ("辽上京", 119.39, 43.97), ("金陵", 118.78, 32.05), ("杭州", 120.17, 30.25), ("福州", 119.3, 26.08), ("长沙", 112.98, 28.2), ("兴王府", 113.26, 23.13), ("成都", 104.06, 30.67), ("江陵", 112.2, 30.35), ("大理", 100.16, 25.69)],
    1000: [("东京开封", 114.35, 34.79), ("辽上京", 119.39, 43.97), ("大理", 100.16, 25.69)],
    1100: [("东京开封", 114.35, 34.79), ("辽上京", 119.39, 43.97), ("兴庆府", 106.23, 38.47), ("大理", 100.16, 25.69)],
    1200: [("临安", 120.17, 30.25), ("金中都", 116.35, 39.88), ("兴庆府", 106.23, 38.47), ("大理", 100.16, 25.69)],
    1279: [("大都", 116.4, 39.95), ("上都", 116.18, 42.36)],
    1500: [("北京", 116.4, 39.91), ("南京", 118.78, 32.05)],
    1600: [("北京", 116.4, 39.91), ("南京", 118.78, 32.05)],
    1640: [("北京", 116.4, 39.91), ("盛京", 123.43, 41.8), ("南京", 118.78, 32.05)],
    1650: [("北京", 116.4, 39.91), ("肇庆（南明永历）", 112.47, 23.05)],
    1800: [("北京", 116.4, 39.91)],
    1900: [("北京", 116.4, 39.91)],
}

# 周边政权与文化的中文名
NEIGHBORS = {
    "Xiongnu": "匈奴", "Koguryo": "高句丽", "Silla": "新罗", "Silia": "新罗", "Paekche": "百济",
    "Gaya": "伽倻", "Yamato": "倭", "Göktürks": "突厥", "Uyghurs": "回鹘", "Korea": "朝鲜",
    "Goryeo": "高丽", "Annam": "安南", "Đại Việt": "大越", "Mongols": "蒙古诸部",
    "Mongol Empire": "蒙古诸部", "Khitans": "契丹", "Jōmon": "绳文文化", "Yayoi": "弥生文化",
    "Gojoseon": "古朝鲜", "Donghu tribes": "东胡", "Yuezhi": "月氏", "Ruanruan": "柔然",
    "Chagatai Khanate": "察合台汗国", "Mughal Empire": "莫卧儿帝国", "British Raj": "英属印度",
    "French Indochina": "法属印度支那", "Burma": "缅甸", "Laos": "老挝", "Ayutthaya": "阿瑜陀耶",
    "Kingdom of Pagan": "蒲甘", "Pagan": "蒲甘", "Bagan": "蒲甘", "Nepal": "尼泊尔",
    "Tungus": "通古斯诸部", "Turcik tribes": "突厥诸部", "Proto-Altaic pastoralists": "草原游牧部落",
    "Karasuk culture": "卡拉苏克文化", "Andronovo": "安德罗诺沃文化", "Afanasevo": "阿凡纳谢沃文化",
    "Paleo-Koreans": "古朝鲜半岛居民", "Koreans": "朝鲜半岛居民", "Quazaq Khanate": "哈萨克汗国",
    "central Asian khanates": "中亚诸汗国", "Kurykans": "骨利干", "Karluks": "葛逻禄",
    "Kimek-Kipchak khaganate": "钦察", "Karkhanids": "喀喇汗王朝", "Tibetans": "古羌藏先民",
    "Tibeto-Burmanese": "藏缅先民", "Austro-Asiatic rice cultures": "南亚语系稻作文化",
    "Thai": "傣泰先民", "Burmese": "缅人先民", "Saka Kingdom": "塞种", "Zhangzhung Kingdom": "象雄",
    "Proto-Tibetan cultures": "古藏先民", "Proto-Thai cultures": "傣泰先民", "Tibet": "吐蕃",
}

DROP = {"Sinic", "None", None}


# ---------- 几何工具 ----------
def rdp(points, eps):
    if len(points) < 3:
        return points
    stack = [(0, len(points) - 1)]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    while stack:
        s, e = stack.pop()
        (x1, y1), (x2, y2) = points[s], points[e]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-9
        best, idx = 0.0, -1
        for i in range(s + 1, e):
            x0, y0 = points[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
            if d > best:
                best, idx = d, i
        if best > eps and idx > 0:
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
    return [p for p, k in zip(points, keep) if k]


def ring_area(pts):
    a = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        a += x1 * y2 - x2 * y1
    return a / 2


def ring_centroid(pts):
    a = ring_area(pts) or 1e-9
    cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        f = x1 * y2 - x2 * y1
        cx += (x1 + x2) * f
        cy += (y1 + y2) * f
    return cx / (6 * a), cy / (6 * a)


def polygons(geom):
    """返回多边形列表；空几何或几何集合中的非面要素被忽略。"""
    if geom["type"] == "GeometryCollection":
        return [p for g in geom["geometries"] for p in polygons(g)]
    if not geom.get("coordinates"):
        return []
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def in_view(geom):
    for poly in polygons(geom):
        for lon, lat in poly[0]:
            if LON0 - 5 < lon < LON1 + 5 and LAT0 - 5 < lat < LAT1 + 5:
                return True
    return False


def to_path(geom):
    """投影、简化，返回 (SVG path, 最大块面积, 最大块质心)。"""
    parts, biggest, center = [], 0.0, None
    for poly in polygons(geom):
        for k, ring in enumerate(poly):
            pts = [project(lon, lat) for lon, lat in ring]
            # 闭合环首尾相同，直接简化会退化，故从中点拆成两段分别简化
            mid = len(pts) // 2
            pts = rdp(pts[:mid + 1], SIMPLIFY_PX)[:-1] + rdp(pts[mid:], SIMPLIFY_PX)
            if len(pts) < 4:
                continue
            area = abs(ring_area(pts))
            if area < MIN_RING_PX2:
                continue
            if k == 0 and area > biggest:
                biggest, center = area, ring_centroid(pts)
            parts.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts[:-1]) + "Z")
    return "".join(parts), biggest, center


def apply_splits(features, splits):
    """从 src 中切出 region 范围，作为名为 name 的新政权（需要 shapely）。"""
    from shapely.geometry import Polygon, mapping, shape

    by_name = {ft["properties"].get("NAME"): ft for ft in features if ft.get("geometry")}
    for src, name, region in splits:
        a = shape(by_name[src]["geometry"])
        region = Polygon(region)
        piece = a.intersection(region)
        if piece.is_empty:
            continue
        features.append({"properties": {"NAME": name}, "geometry": mapping(piece)})
        by_name[src]["geometry"] = mapping(a.difference(region))


def apply_merges(features, merges):
    """把 src 整体并入 dst（如 926 年渤海被契丹所灭）。"""
    from shapely.geometry import mapping, shape

    by_name = {ft["properties"].get("NAME"): ft for ft in features if ft.get("geometry")}
    for src, dst in merges:
        merged = shape(by_name[dst]["geometry"]).union(shape(by_name[src]["geometry"])).buffer(0)
        by_name[dst]["geometry"] = mapping(merged)
        by_name[src]["geometry"] = None


def apply_moves(features, moves):
    """把 src 位于 region 内的部分划给 dst。"""
    from shapely.geometry import Polygon, mapping, shape

    by_name = {ft["properties"].get("NAME"): ft for ft in features if ft.get("geometry")}
    for src, dst, region in moves:
        region = Polygon(region)
        a, b = shape(by_name[src]["geometry"]), shape(by_name[dst]["geometry"])
        by_name[src]["geometry"] = mapping(a.difference(region))
        by_name[dst]["geometry"] = mapping(b.union(a.intersection(region)).buffer(0))


def apply_fixes(features, fixes):
    """把 src 位于分界线以北的部分划给 dst（需要 shapely，见 scripts/requirements.txt）。"""
    from shapely.geometry import Polygon, mapping, shape

    by_name = {ft["properties"].get("NAME"): ft for ft in features if ft.get("geometry")}
    for src, dst, line in fixes:
        region = Polygon(north_of(line))
        a, b = shape(by_name[src]["geometry"]), shape(by_name[dst]["geometry"])
        moved = a.intersection(region)
        by_name[src]["geometry"] = mapping(a.difference(region))
        by_name[dst]["geometry"] = mapping(b.union(moved).buffer(0))


def build(src_dir):
    frames = []
    for cfg in FRAMES:
        data = json.load(open(os.path.join(src_dir, f"world_{cfg['src']}.geojson"), encoding="utf-8"))
        if cfg.get("merge"):
            apply_merges(data["features"], cfg["merge"])
        if cfg.get("fix"):
            apply_fixes(data["features"], cfg["fix"])
        if cfg.get("move"):
            apply_moves(data["features"], cfg["move"])
        if cfg.get("split"):
            apply_splits(data["features"], cfg["split"])
        if cfg.get("merge_after"):
            apply_merges(data["features"], cfg["merge_after"])
        shapes = []
        for ft in data["features"]:
            name = ft["properties"].get("NAME")
            geom = ft.get("geometry")
            if name in DROP or not geom or not in_view(geom):
                continue
            role, dyn, label, *anchor = cfg["map"].get(name, ("other", None, NEIGHBORS.get(name, "")))
            d, area, center = to_path(geom)
            if not d:
                continue
            shape = {"role": role, "d": d}
            if dyn:
                shape["id"] = dyn
            # 帧配置中点名的区域（如西梁）即使面积小也显示标签
            min_area = LABEL_MIN_REGIME_PX2 if role != "other" or name in cfg["map"] else LABEL_MIN_PX2
            if label and center and area >= min_area and 0 < center[0] < WIDTH and 0 < center[1] < HEIGHT:
                shape["label"] = label
                lx, ly = project(*anchor[0]) if anchor else center
                shape["lx"], shape["ly"] = round(lx), round(ly)
                shape["big"] = area > 25000
            shapes.append(shape)
        order = {"other": 0, "adm": 1, "para": 2, "main": 3}
        shapes.sort(key=lambda s: order[s["role"]])
        capitals = []
        for name, lon, lat in CAPITALS.get(cfg["year"], []):
            cx, cy = project(lon, lat)
            capitals.append({"name": name, "x": round(cx, 1), "y": round(cy, 1)})
        frames.append({k: cfg[k] for k in ("year", "title", "focus", "desc")}
                      | {"shapes": shapes, "capitals": capitals})

    # 底图：现代陆地轮廓（只填色、不画国界）
    land = json.load(open(os.path.join(src_dir, "world_2010.geojson"), encoding="utf-8"))
    base = "".join(to_path(ft["geometry"])[0] for ft in land["features"]
                   if ft.get("geometry") and in_view(ft["geometry"]))

    return {
        "source": "historical-basemaps by A. Ourednik (GPL-3.0), https://github.com/aourednik/historical-basemaps",
        "width": WIDTH, "height": round(HEIGHT, 1),
        "base": base, "frames": frames,
    }


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "map", "borders.json")
    result = build(sys.argv[1])
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {out}: {len(result['frames'])} frames, {os.path.getsize(out) // 1024} KB")
