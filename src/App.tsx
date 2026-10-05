import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/layout/Layout";
import Assinantes from "@/pages/Assinantes";
import NaoEncontrada from "@/pages/NaoEncontrada";

const Assinar = lazy(() => import("@/pages/Assinar"));
const Cobrancas = lazy(() => import("@/pages/Cobrancas"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Carregando">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Assinantes />} />
            <Route path="assinar/:usuarioId" element={<Assinar />} />
            <Route path="cobrancas" element={<Cobrancas />} />
            <Route path="*" element={<NaoEncontrada />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
