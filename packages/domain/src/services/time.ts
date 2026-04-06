import {
  differenceInMilliseconds,
  differenceInMinutes,
  addMilliseconds,
  addMinutes,
  addHours,
  isAfter,
} from "date-fns";

const UNIX_EPOCH = new Date(0);

export function durationMinutesToMilliseconds(minutes: number) {
  return addMinutes(UNIX_EPOCH, minutes).getTime();
}

export function durationHoursToMilliseconds(hours: number) {
  return addHours(UNIX_EPOCH, hours).getTime();
}

export function addMillisecondsToTimestamp(
  timestamp: number,
  durationMs: number,
) {
  return addMilliseconds(new Date(timestamp), durationMs).getTime();
}

export function differenceInSafeMinutes(
  laterTimestamp: number,
  earlierTimestamp: number,
) {
  return Math.max(
    0,
    differenceInMinutes(new Date(laterTimestamp), new Date(earlierTimestamp)),
  );
}

export function differenceInSafeMilliseconds(
  laterTimestamp: number,
  earlierTimestamp: number,
) {
  return Math.max(
    0,
    differenceInMilliseconds(
      new Date(laterTimestamp),
      new Date(earlierTimestamp),
    ),
  );
}

export function isTimestampAfter(leftTimestamp: number, rightTimestamp: number) {
  return isAfter(new Date(leftTimestamp), new Date(rightTimestamp));
}
