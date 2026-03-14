export function buildQuery(table: string, field: string, value: string): string {
  return "SELECT * FROM " + table + " WHERE " + field + "='" + value + "'";
}
