import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PodThumbnailProps {
  imageUrl?: string | null;
  podName: string;
  className?: string;
  iconClassName?: string;
}

const PodThumbnail = ({ imageUrl, podName, className, iconClassName }: PodThumbnailProps) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const showImage = !!imageUrl && !failed;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted",
        className,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl!}
          alt={`${podName} pod`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Users className={cn("h-4 w-4 text-muted-foreground", iconClassName)} />
      )}
    </div>
  );
};

export default PodThumbnail;