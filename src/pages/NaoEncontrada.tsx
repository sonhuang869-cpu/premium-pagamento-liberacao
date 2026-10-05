import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NaoEncontrada() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <SearchX className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-6 text-2xl font-bold">Essa página não existe</h1>
      <p className="mt-2 text-muted-foreground">O endereço pode estar incompleto.</p>
      <Link to="/" className={`${buttonVariants()} mt-6`}>Ver os assinantes</Link>
    </div>
  );
}
