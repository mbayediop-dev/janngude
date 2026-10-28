import type { ShareResourceType } from "@/lib/supabase/types";
import { appUrl } from "@/lib/utils";

export function shareUrl(token: string) {
  return appUrl(`/s/${token}`);
}

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const SHARE_TYPE_LABEL: Record<ShareResourceType, string> = {
  summary: "Résumé",
  quiz: "Quiz",
  audio: "Lecture audio",
  chat: "Discussion",
  course: "Cours",
};

export function shareMessage(type: ShareResourceType, title: string, url: string) {
  const intro: Record<ShareResourceType, string> = {
    summary: `Je te partage un résumé de cours : « ${title} »`,
    quiz: `Je te partage un quiz pour réviser : « ${title} »`,
    audio: `Je te partage la lecture audio d’un cours : « ${title} »`,
    chat: `Je te partage une discussion sur un cours : « ${title} »`,
    course: `Je te partage un cours : « ${title} »`,
  };
  return `${intro[type]}\n${url}`;
}
