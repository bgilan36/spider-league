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
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  hashtags?: string[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  text,
  url = "https://spiderleague.app",
  hashtags = ["SpiderLeague", "WebWarriors"],
  variant = "outline",
  size = "default"
}) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareData = {
    title,
    text,
    url
  };

  const encodedText = encodeURIComponent(`${text}\n\n${url}`);
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  const hashtagString = hashtags.map(tag => `#${tag}`).join(' ');

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({
          title: "Shared successfully!",
          description: "Thanks for spreading the Spider League love! 🕷️",
        });
      } catch (error) {
        // User cancelled or error occurred
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
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

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&hashtags=${hashtags.join(',')}&via=SpiderLeague`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedText}`,
    whatsapp: `https://wa.me/?text=${encodedText}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    sms: `sms:?body=${encodedText}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedText}`
  };

  const openShareUrl = (platform: keyof typeof shareUrls) => {
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