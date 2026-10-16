// @ts-nocheck
export * from '../../../../packages/modcrafting-core/src/template-schemas.ts'
import { templateSchemas, type CraftingGridData } from '../../../../packages/modcrafting-core/src/template-schemas.ts'

export function chineseToEnglishId(name: string): string {
  if (!name) return ''
  let result = name
    .replace(/[\u4e00-\u9fa5]/g, (char) => {
      const pinyinMap: Record<string, string> = {
        '自': 'zi', '定': 'ding', '义': 'yi', '方': 'fang', '块': 'kuai',
        '物': 'wu', '品': 'pin', '食': 'shi', '实': 'shi', '体': 'ti',
        '工': 'gong', '具': 'ju', '护': 'hu', '甲': 'jia', '配': 'pei',
        '方': 'fang', '魔': 'mo', '法': 'fa', '矿': 'kuang', '石': 'shi',
        '木': 'mu', '头': 'tou', '金': 'jin', '属': 'shu', '水': 'shui',
        '晶': 'jing', '泥': 'ni', '土': 'tu', '火': 'huo', '光': 'guang',
        '发': 'fa', '充': 'chong', '能': 'neng', '种': 'zhong', '植': 'zhi',
        '可': 'ke', '燃': 'ran', '掉': 'diao', '落': 'luo', '物': 'wu',
        '生': 'sheng', '长': 'chang', '测': 'ce', '试': 'shi', '武': 'wu',
        '器': 'qi', '材': 'cai', '料': 'liao', '近': 'jin', '战': 'zhan',
        '远': 'yuan', '程': 'cheng', '堆': 'dui', '叠': 'die', '耐': 'nai',
        '久': 'jiu', '度': 'du', '右': 'you', '键': 'jian', '使': 'shi',
        '用': 'yong', '食': 'shi', '用': 'yong', '投': 'tou', '掷': 'zhi',
        '被': 'bei', '动': 'dong', '敌': 'di', '对': 'dui', '中': 'zhong',
        '立': 'li', '飞': 'fei', '行': 'xing', '水': 'shui', '下': 'xia',
        '血': 'xue', '值': 'zhi', '小': 'xiao', '型': 'xing', '中': 'zhong',
        '大': 'da', '巨': 'ju', '型': 'xing', '鸡': 'ji', '牛': 'niu',
        '末': 'mo', '影': 'ying', '龙': 'long', '射': 'she', '送': 'song',
        '瞬': 'shun', '移': 'yi', '治': 'zhi', '疗': 'liao', '挖': 'wa',
        '掘': 'jue', '砍': 'kan', '伐': 'fa', '攻': 'gong', '击': 'ji',
        '多': 'duo', '功': 'gong', '能': 'neng', '范': 'fan', '围': 'wei',
        '破': 'po', '坏': 'huai', '自': 'zi', '动': 'dong', '耕': 'geng',
        '种': 'zhong', '精': 'jing', '准': 'zhun', '采': 'cai', '集': 'ji',
        '时': 'shi', '运': 'yun', '头': 'tou', '盔': 'kui', '胸': 'xiong',
        '腿': 'tui', '靴': 'xue', '全': 'quan', '套': 'tao', '皮': 'pi',
        '革': 'ge', '下': 'xia', '界': 'jie', '合': 'he', '金': 'jin',
        '防': 'fang', '护': 'hu', '火': 'huo', '焰': 'yan', '抗': 'kang',
        '水': 'shui', '下': 'xia', '呼': 'hu', '吸': 'xi', '夜': 'ye',
        '视': 'shi', '有': 'you', '序': 'xu', '无': 'wu', '熔': 'rong',
        '炉': 'lu', '酿': 'niang', '造': 'zao', '高': 'gao', '级': 'ji',
        '饮': 'yin', '品': 'pin', '增': 'zeng', '益': 'yi', '效': 'xiao',
        '果': 'guo', '食': 'shi', '腐': 'fu', '动': 'dong', '物': 'wu',
        '速': 'su', '度': 'du', '力': 'li', '量': 'liang', '跳': 'tiao',
        '跃': 'yue', '提': 'ti', '升': 'sheng'
      }
      return pinyinMap[char] || char
    })
    .replace(/[^a-z0-9_]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()

  if (!result) {
    result = name
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase()
  }

  return result
}

export function generatePromptFromForm(templateId: string, formData: Record<string, unknown>): string {
  const schema = templateSchemas[templateId]
  if (!schema) return `我需要创建一个${templateId}模组。请输出结构化实施计划。`

  let prompt = `我需要创建一个${schema.name}模组，模板ID：${templateId}。\n\n详细信息：\n`

  for (const field of schema.fields) {
    const value = formData[field.key]
    if (value !== undefined && value !== null && value !== '') {
      const label = field.label
      let displayValue = String(value)

      if (field.type === 'select' && field.options) {
        const option = field.options.find(o => o.value === value)
        if (option) {
          displayValue = option.label
        }
      }

      if (field.type === 'craftingGrid') {
        const gridData = value as CraftingGridData
        if (gridData) {
          const { grid, outputItem, outputCount } = gridData
          prompt += `- 输出物品：${outputItem || '未设置'} x${outputCount}\n`
          prompt += `- 输入材料：\n`

          const materials: Record<string, number> = {}
          grid.forEach(row => {
            row.forEach(slot => {
              if (slot.itemId) {
                materials[slot.itemId] = (materials[slot.itemId] || 0) + (slot.count || 1)
              }
            })
          })

          if (Object.keys(materials).length === 0) {
            prompt += `  无（空配方）\n`
          } else {
            Object.entries(materials).forEach(([itemId, count]) => {
              prompt += `  - ${itemId} x${count}\n`
            })
          }

          // 使用 [][][] 格式：每格填物品ID，空格留空字符串，便于 AI 理解多物品对应关系
          prompt += `- 合成形状（3x3网格，每格填物品ID，空格留空）：\n`
          grid.forEach(row => {
            const cells = row.map(slot => slot.itemId || '')
            prompt += `  [${cells.join('][')}]\n`
          })
          prompt += `- 形状说明：上述网格按行排列，'[' ']' 分隔每格，空字符串表示该格无物品\n`
          continue
        }
      }

      prompt += `- ${label}：${displayValue}\n`
    }
  }

  prompt +=
    '\n表单信息已齐全，无需 list_directory/read_file 探索项目。' +
    '\n请直接输出结构化实施计划，每行一个步骤：`N. [kind] 简短标题 — 目标路径`，其中 kind 为 write、recipe 或 inspect。' +
    '\n不要只回复一句开场白就结束，必须列出完整步骤。'

  return prompt
}
