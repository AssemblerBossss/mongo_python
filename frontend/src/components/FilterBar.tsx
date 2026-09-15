import { useEffect, useState } from "react";
import type { FilterCondition, FilterFieldInfo } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

interface FilterBarProps {
  filters: FilterFieldInfo[];
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
}

function isBoolField(field: FilterFieldInfo): boolean {
  return field.types.length === 1 && field.types[0] === "bool";
}

function setCondition(
  conditions: FilterCondition[],
  field: string,
  next: FilterCondition | null,
): FilterCondition[] {
  const withoutField = conditions.filter((condition) => condition.field !== field);
  return next ? [...withoutField, next] : withoutField;
}

function getSelectedValues(condition: FilterCondition | undefined): unknown[] {
  if (!condition) return [];
  return condition.operator === "in" ? (condition.value as unknown[]) : [condition.value];
}

function EnumFilter({
  filterField,
  condition,
  onChange,
}: {
  filterField: FilterFieldInfo;
  condition: FilterCondition | undefined;
  onChange: (next: FilterCondition | null) => void;
}): JSX.Element {
  const selected = getSelectedValues(condition);

  function toggle(value: unknown): void {
    const isSelected = selected.some((item) => item === value);
    const nextSelected = isSelected
      ? selected.filter((item) => item !== value)
      : [...selected, value];

    if (nextSelected.length === 0) {
      onChange(null);
    } else if (nextSelected.length === 1) {
      onChange({ field: filterField.field, operator: "eq", value: nextSelected[0] });
    } else {
      onChange({ field: filterField.field, operator: "in", value: nextSelected });
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {filterField.values?.map((value) => {
        const active = selected.some((item) => item === value);
        return (
          <button
            key={String(value)}
            type="button"
            onClick={() => toggle(value)}
            className={`rounded border px-2 py-1 text-xs ${
              active ? "border-gray-800 bg-gray-800 text-white" : "border-gray-300 bg-white"
            }`}
          >
            {String(value)}
          </button>
        );
      })}
    </div>
  );
}

function BoolFilter({
  filterField,
  condition,
  onChange,
}: {
  filterField: FilterFieldInfo;
  condition: FilterCondition | undefined;
  onChange: (next: FilterCondition | null) => void;
}): JSX.Element {
  const current = condition?.operator === "eq" ? (condition.value as boolean) : undefined;

  const options: { label: string; value: boolean | undefined }[] = [
    { label: "Любое", value: undefined },
    { label: "Да", value: true },
    { label: "Нет", value: false },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = current === option.value;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() =>
              onChange(
                option.value === undefined
                  ? null
                  : { field: filterField.field, operator: "eq", value: option.value },
              )
            }
            className={`rounded border px-2 py-1 text-xs ${
              active ? "border-gray-800 bg-gray-800 text-white" : "border-gray-300 bg-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function TextFilter({
  filterField,
  condition,
  onChange,
}: {
  filterField: FilterFieldInfo;
  condition: FilterCondition | undefined;
  onChange: (next: FilterCondition | null) => void;
}): JSX.Element {
  const operator = filterField.operators.includes("contains") ? "contains" : "eq";
  const [draft, setDraft] = useState(condition ? String(condition.value) : "");
  const debounced = useDebouncedValue(draft);

  useEffect(() => {
    if (!debounced.trim()) {
      onChange(null);
      return;
    }
    onChange({ field: filterField.field, operator, value: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <input
      className="w-full rounded border px-2 py-1 text-sm"
      placeholder={operator === "contains" ? "содержит…" : "точное совпадение…"}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

export function FilterBar({ filters, conditions, onChange }: FilterBarProps): JSX.Element | null {
  const [resetToken, setResetToken] = useState(0);

  if (filters.length === 0) {
    return null;
  }

  function updateField(field: string, next: FilterCondition | null): void {
    onChange(setCondition(conditions, field, next));
  }

  function resetAll(): void {
    onChange([]);
    setResetToken((token) => token + 1);
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-3">
      <div className="flex flex-wrap gap-4">
        {filters.map((filterField) => {
          const condition = conditions.find((item) => item.field === filterField.field);
          return (
            <div key={filterField.field} className="flex min-w-[10rem] flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">{filterField.field}</span>
              {isBoolField(filterField) ? (
                <BoolFilter
                  filterField={filterField}
                  condition={condition}
                  onChange={(next) => updateField(filterField.field, next)}
                />
              ) : filterField.enumerable ? (
                <EnumFilter
                  filterField={filterField}
                  condition={condition}
                  onChange={(next) => updateField(filterField.field, next)}
                />
              ) : (
                <TextFilter
                  key={resetToken}
                  filterField={filterField}
                  condition={condition}
                  onChange={(next) => updateField(filterField.field, next)}
                />
              )}
            </div>
          );
        })}
      </div>
      {conditions.length > 0 && (
        <button
          type="button"
          className="self-start text-xs text-gray-600 underline"
          onClick={resetAll}
        >
          Сбросить фильтр
        </button>
      )}
    </div>
  );
}
