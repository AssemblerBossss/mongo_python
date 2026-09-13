import { Link } from "react-router-dom";

export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="text-lg font-medium">Страница не найдена</p>
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        Вернуться к списку коллекций
      </Link>
    </div>
  );
}
