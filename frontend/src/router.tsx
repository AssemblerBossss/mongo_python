import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { CollectionsPage } from "./pages/CollectionsPage";
import { CollectionPage } from "./pages/CollectionPage";
import { DocumentPage } from "./pages/DocumentPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Точка расширения: доменные страницы добавляются сюда как дочерние маршруты App.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <CollectionsPage /> },
      { path: "collections/:name", element: <CollectionPage /> },
      { path: "collections/:name/documents/:id", element: <DocumentPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
