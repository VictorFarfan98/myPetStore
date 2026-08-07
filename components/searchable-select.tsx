"use client";

import { useId, useState } from "react";

type Option<T extends string | number> = { value: T; label: string };

export function SearchableSelect<T extends string | number>({
  options,
  value,
  onChange,
  placeholder = "Buscar..."
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");

  return (
    <>
      <input
        className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
        list={listId}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          onChange(options.find((option) => option.label === nextQuery)?.value ?? null);
        }}
      />
      <datalist id={listId}>
        {options.map((option) => <option key={String(option.value)} value={option.label} />)}
      </datalist>
    </>
  );
}
