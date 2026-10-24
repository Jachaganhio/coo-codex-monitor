// Deterministic excerpts, never a model-generated interpretation.
export function extractConclusion(input: unknown): { summary: string; finalAnswer: string } | undefined {
  if (typeof input !== 'string' || !input.trim()) return;
  const finalAnswer = input.slice(0, 64000)
    .replace(/<oai-mem-citation>[\s\S]*?(?:<\/oai-mem-citation>|$)/g, '')
    .replace(/\b(?:sk-[\w-]{8,}|Bearer\s+[\w.+/-]{12,})/gi, '[已隐藏凭据]')
    .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[已隐藏]')
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim();
  const lines = finalAnswer.replace(/```[\s\S]*?(?:```|$)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .split(/\r?\n/).map(s => s.replace(/^\s*(?:#{1,6}\s*|[-*+]\s+|\d+\.\s+)/, '').replace(/[*`_]/g, '').trim())
    .filter(s => s.length > 4 && !/^https?:\/\//.test(s));
  if (!lines.length) return { summary: '暂无可提取的文字结论，请查看完整答复。', finalAnswer };
  const selected = [lines[0], ...lines.slice(1).filter(s => /测试|验证|待|尚未|失败|未完成|注意|test|verif|fail|pending|remaining/i.test(s)).slice(0, 2)];
  return { summary: selected.map(s => s.length > 80 ? s.slice(0, 79) + '…' : s).join('\n').slice(0, 250), finalAnswer };
}
