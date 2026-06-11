import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Share2, 
  Copy, 
  MessageCircle, 
  Mail, 
  ExternalLink,
  Check,
  Image as ImageIcon,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  hashtags?: string[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  /**
   * Optional async generator that returns a PNG/JPEG Blob summarizing the
   * thing being shared (e.g. a battle result card). When provided, the
   * dropdown exposes "Share image" (native share w/ file) and "Download
   * image" actions so users can quickly post the visual on iMessage,
   * Instagram, X, etc.
   */
  getShareImage?: () => Promise<Blob | null>;
  imageFileName?: string;
  /**
   * Optional async hook called once on first share action. Returns the
   * canonical, crawler-friendly URL that should be embedded in links so
   * iMessage / WhatsApp / Slack unfurl the proper card. Used together
   * with the og-card edge function. If it returns null, falls back to
   * the `url` prop.
   */
  prepareShareUrl?: () => Promise<string | null>;
}

const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  text,
  url = "https://spiderleague.app",
  hashtags = ["SpiderLeague", "WebWarriors"],
  variant = "outline",
  size = "default",
  getShareImage,
  imageFileName = "spider-league.png",
  prepareShareUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [busyImage, setBusyImage] = useState(false);
  const { toast } = useToast();

  // Lazily resolve the share URL once, then memoize it for subsequent
  // actions in the same dropdown session.
  const resolvedUrlRef = React.useRef<string | null>(null);
  const resolveUrl = async (): Promise<string> => {
    if (resolvedUrlRef.current) return resolvedUrlRef.current;
    if (prepareShareUrl) {
      try {
        const u = await prepareShareUrl();
        if (u) {
          resolvedUrlRef.current = u;
          return u;
        }
      } catch (e) {
        console.warn("prepareShareUrl failed", e);
      }
    }
    resolvedUrlRef.current = url;
    return url;
  };

  const handleNativeShare = async () => {
    const shareUrl = await resolveUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${text}\n\n${shareUrl}`, url: shareUrl });
        toast({
          title: "Shared successfully!",
          description: "Thanks for spreading the Spider League love! 🕷️",
        });
      } catch (error) {
        // User cancelled or error occurred
      }
    }
  };

  const handleShareImage = async () => {
    if (!getShareImage) return;
    setBusyImage(true);
    try {
      const shareUrl = await resolveUrl();
      const blob = await getShareImage();
      if (!blob) throw new Error("Could not generate image");
      const file = new File([blob], imageFileName, { type: blob.type || "image/png" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title, text: `${text}\n\n${shareUrl}` });
        toast({ title: "Shared!", description: "Battle card on its way 🕷️" });
      } else {
        // Fallback: trigger download so the user can post it manually.
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = imageFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(u);
        toast({
          title: "Image downloaded",
          description: "Attach it to a text or post it anywhere!",
        });
      }
    } catch (e: any) {
      toast({ title: "Couldn't share image", description: e.message, variant: "destructive" });
    } finally {
      setBusyImage(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!getShareImage) return;
    setBusyImage(true);
    try {
      const blob = await getShareImage();
      if (!blob) throw new Error("Could not generate image");
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = imageFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
      toast({ title: "Image downloaded", description: "Share it anywhere 🚀" });
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyImage(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = await resolveUrl();
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied!",
        description: "Share it anywhere to grow the Spider League! 🔗",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again or use manual sharing.",
        variant: "destructive",
      });
    }
  };

  const openShareUrl = async (platform: "twitter" | "facebook" | "linkedin" | "whatsapp" | "telegram" | "sms" | "email") => {
    const shareUrl = await resolveUrl();
    const encodedText = encodeURIComponent(`${text}\n\n${shareUrl}`);
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(shareUrl);
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&hashtags=${hashtags.join(',')}&via=SpiderLeague`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      sms: `sms:?body=${encodedText}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedText}`,
    } as const;
    window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    toast({
      title: "Opening share window...",
      description: "Share the Spider League excitement! 🚀",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {getShareImage && (
          <>
            <DropdownMenuItem onClick={handleShareImage} disabled={busyImage} className="gap-2">
              <ImageIcon className="h-4 w-4" />
              {busyImage ? "Preparing image…" : "Share battle image"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadImage} disabled={busyImage} className="gap-2">
              <Download className="h-4 w-4" />
              Download image
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {navigator.share && (
          <>
            <DropdownMenuItem onClick={handleNativeShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              Share via device
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={() => openShareUrl('twitter')} className="gap-2">
          <div className="h-4 w-4 bg-blue-400 rounded-sm flex items-center justify-center text-white text-xs font-bold">
            𝕏
          </div>
          Share on X (Twitter)
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => openShareUrl('facebook')} className="gap-2">
          <div className="h-4 w-4 bg-blue-600 rounded-sm flex items-center justify-center text-white text-xs font-bold">
            f
          </div>
          Share on Facebook
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => openShareUrl('linkedin')} className="gap-2">
          <div className="h-4 w-4 bg-blue-700 rounded-sm flex items-center justify-center text-white text-xs font-bold">
            in
          </div>
          Share on LinkedIn
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => openShareUrl('whatsapp')} className="gap-2">
          <div className="h-4 w-4 bg-green-500 rounded-sm flex items-center justify-center text-white text-xs font-bold">
            W
          </div>
          Share on WhatsApp
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => openShareUrl('sms')} className="gap-2">
          <MessageCircle className="h-4 w-4" />
          Share via SMS
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => openShareUrl('email')} className="gap-2">
          <Mail className="h-4 w-4" />
          Share via Email
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareButton;