// helper for adding calendar months. If target month has fewer days (e.g. Jan 31 -> Feb), clamps to last day
export function addCalendarMonths(startDate: Date, monthsToAdd: number): Date {
  const originalDay = startDate.getUTCDate();
  
  // Calculate target month and year
  const totalMonths = startDate.getUTCFullYear() * 12 + startDate.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12;
  
  // Determine days in target month
  // Day 0 of next month is the last day of target month
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(originalDay, daysInTargetMonth);
  
  // Construct clean Date object directly in UTC avoiding intermediate day overflow
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    clampedDay,
    startDate.getUTCHours(),
    startDate.getUTCMinutes(),
    startDate.getUTCSeconds(),
    startDate.getUTCMilliseconds()
  ));
}

/**
 * Calculates First Marking Original Due Date: Exactly 3 calendar months from collection date
 */
export function calculateFirstMarkingDueDate(collectedAt: Date): Date {
  return addCalendarMonths(collectedAt, 3);
}

/**
 * Calculates Second Marking Original Due Date: Exactly 1 calendar month from courier dispatch date
 */
export function calculateSecondMarkingDueDate(courierDispatchedAt: Date): Date {
  return addCalendarMonths(courierDispatchedAt, 1);
}

/**
 * Checks if a given due date is overdue compared to now (or optional reference date)
 */
export function isOverdue(dueDate: Date | null, referenceDate: Date = new Date()): boolean {
  if (!dueDate) return false;
  return referenceDate.getTime() > dueDate.getTime();
}
