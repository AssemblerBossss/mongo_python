interface PaginationProps {
  skip: number;
  limit: number;
  total: number;
  onSkipChange: (skip: number) => void;
}

export function Pagination({ skip, limit, total, onSkipChange }: PaginationProps): JSX.Element {
  const hasPrev = skip > 0;
  const hasNext = skip + limit < total;

  return (
    <div className="flex items-center justify-between py-2 text-sm text-gray-600">
      <span>
        {skip + 1}–{Math.min(skip + limit, total)} из {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!hasPrev}
          className="rounded border px-2 py-1 disabled:opacity-40"
          onClick={() => onSkipChange(Math.max(0, skip - limit))}
        >
          Назад
        </button>
        <button
          type="button"
          disabled={!hasNext}
          className="rounded border px-2 py-1 disabled:opacity-40"
          onClick={() => onSkipChange(skip + limit)}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
