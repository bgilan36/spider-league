import React, { useEffect } from "react";
import { openChallengeResponse } from "@/lib/challenges";

interface ChallengeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: { id: string } | null;
  onChallengeAccepted?: (...args: any[]) => void;
}

/**
 * Compatibility wrapper: challenge review/accept now lives in the shared
 * ChallengeResponseDialog (server-validated, with preview + consent).
 */
const ChallengeDetailsModal: React.FC<ChallengeDetailsModalProps> = ({ isOpen, onClose, challenge, onChallengeAccepted }) => {
  useEffect(() => {
    if (!isOpen || !challenge) return;
    openChallengeResponse(challenge.id);
    const done = () => onChallengeAccepted?.();
    window.addEventListener("challenge:accepted", done, { once: true });
    onClose();
    return () => window.removeEventListener("challenge:accepted", done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, challenge?.id]);
  return null;
};

export default ChallengeDetailsModal;
