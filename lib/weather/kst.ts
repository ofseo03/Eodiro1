const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** UTC 기준 Date를 KST 벽시계 값으로 분해한다. */
export function toKstParts(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS)
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** KST 기준 YYYYMMDD 문자열. */
export function kstDateString(date: Date): string {
  const { year, month, day } = toKstParts(date)
  return `${year}${pad(month)}${pad(day)}`
}

/** KST 기준 HH00 문자열. */
export function kstHourString(date: Date): string {
  return `${pad(toKstParts(date).hour)}00`
}

/** KST 기준으로 일수를 더한 Date. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
