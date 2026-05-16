import { Loader2, UploadCloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UploadStepProps {
  progress: number;
  fileName: string | null;
  hasFile: boolean;
}

export function UploadStep({ progress, fileName, hasFile }: UploadStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-vault" />
          {hasFile ? "Enviando arquivo..." : "Salvando cofre..."}
        </DialogTitle>
        <DialogDescription>
          {hasFile
            ? "Não feche esta página até concluir. O upload é resumível se a conexão cair."
            : "Só um instante."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {hasFile && fileName && (
          <p className="truncate text-xs font-medium text-foreground">{fileName}</p>
        )}
        {hasFile ? (
          <>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progress < 100 ? "Enviando..." : "Finalizando..."}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {progress}%
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </>
  );
}
