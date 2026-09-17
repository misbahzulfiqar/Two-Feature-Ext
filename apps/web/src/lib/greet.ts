export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function dayGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}
