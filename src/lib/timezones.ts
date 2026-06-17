// A pragmatic list of timezone offsets for the birth-time form. Saju is
// traditionally computed against the birthplace's standard time, so we ask the
// user to pick the zone their birth time was recorded in.
export interface TzOption {
  label: string;
  offset: number;
}

export const TIMEZONES: TzOption[] = [
  { label: '(UTC−12:00) Baker Island', offset: -12 },
  { label: '(UTC−11:00) Samoa', offset: -11 },
  { label: '(UTC−10:00) Hawaii', offset: -10 },
  { label: '(UTC−09:00) Alaska', offset: -9 },
  { label: '(UTC−08:00) US Pacific (LA, Vancouver)', offset: -8 },
  { label: '(UTC−07:00) US Mountain (Denver)', offset: -7 },
  { label: '(UTC−06:00) US Central (Chicago, Mexico City)', offset: -6 },
  { label: '(UTC−05:00) US Eastern (New York, Toronto)', offset: -5 },
  { label: '(UTC−04:00) Atlantic / Santiago', offset: -4 },
  { label: '(UTC−03:00) São Paulo, Buenos Aires', offset: -3 },
  { label: '(UTC−01:00) Azores', offset: -1 },
  { label: '(UTC+00:00) London, Lisbon, Accra', offset: 0 },
  { label: '(UTC+01:00) Paris, Berlin, Lagos', offset: 1 },
  { label: '(UTC+02:00) Cairo, Athens, Johannesburg', offset: 2 },
  { label: '(UTC+03:00) Moscow, Istanbul, Nairobi', offset: 3 },
  { label: '(UTC+03:30) Tehran', offset: 3.5 },
  { label: '(UTC+04:00) Dubai', offset: 4 },
  { label: '(UTC+05:00) Karachi', offset: 5 },
  { label: '(UTC+05:30) India (Delhi, Mumbai)', offset: 5.5 },
  { label: '(UTC+06:00) Dhaka, Almaty', offset: 6 },
  { label: '(UTC+07:00) Bangkok, Jakarta, Hanoi', offset: 7 },
  { label: '(UTC+08:00) Beijing, Singapore, Manila', offset: 8 },
  { label: '(UTC+09:00) Korea, Japan', offset: 9 },
  { label: '(UTC+10:00) Sydney, Guam', offset: 10 },
  { label: '(UTC+12:00) Auckland, Fiji', offset: 12 },
];
