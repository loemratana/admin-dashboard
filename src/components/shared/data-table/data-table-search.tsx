import { Search } from "lucide-react";

type DataTableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DataTableSearch({ value, onChange, placeholder = "Search..." }: DataTableSearchProps) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-md border border-border bg-card py-1.5 pr-3 pl-8 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
    </div>
  );
}
