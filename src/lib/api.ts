// Адрес сервера. Если задан VITE_API_BASE (например http://your-server.com/api) —
// все функции вызываются как {VITE_API_BASE}/{имя-функции}. Иначе используются облачные URL.
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const fn = (name: string, cloudUrl: string) =>
  API_BASE ? `${API_BASE}/${name}` : cloudUrl;

const CHATS_URL = fn("chats", "https://functions.poehali.dev/056b4c53-e701-4434-85b9-7ae146e97dc5");
const MEDIA_URL = fn("media-upload", "https://functions.poehali.dev/6cc8c85a-b5e1-404b-ab3e-315b58940f51");
const STORIES_URL = fn("stories", "https://functions.poehali.dev/fe54577c-6c23-457c-934b-948b3402a10c");
const AUTH_URL = fn("max-auth", "https://functions.poehali.dev/fb5f08dd-1ca0-4e74-9ab7-eea1b2889a88");
const SOCIAL_URL = fn("social", "https://functions.poehali.dev/c8953d78-cff5-4acb-afcf-abf723ad4cf4");

function token(): string {
  return localStorage.getItem("auth_token") || "";
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("auth_user") || "null");
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", "X-Auth-Token": token() };
}

async function req(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

export interface Chat {
  id: number;
  type: string;
  title: string;
  avatar_url: string | null;
  other_id: number | null;
  online: boolean;
  last_text: string | null;
  last_type: string | null;
  last_time: string | null;
  unread: number;
}

export interface Reaction {
  emoji: string;
  user_id: number;
}

export interface Message {
  id: number;
  sender_id: number;
  type: string;
  text: string | null;
  media_url: string | null;
  media_meta: Record<string, unknown> | null;
  reply_to: number | null;
  reply_text?: string | null;
  reply_type?: string | null;
  reply_sender?: string | null;
  created_at: string;
  edited_at: string | null;
  sender_name: string;
  sender_avatar: string | null;
  reactions: Reaction[] | null;
  read_count: number;
}

export interface SearchUser {
  id: number;
  name: string;
  phone: string;
  avatar_url: string | null;
}

export interface Post {
  id: number;
  text: string | null;
  media_url: string | null;
  created_at: string;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
  likes: number;
  comments?: number;
  liked: boolean;
}

export interface Comment {
  id: number;
  text: string;
  created_at: string;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
}

export interface IncomingCall {
  id: number;
  caller_id: number;
  call_type: "audio" | "video";
  offer_sdp: string;
  caller_name: string;
  caller_avatar: string | null;
}

export interface Community {
  id: number;
  type: "group" | "channel";
  title: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: number;
  members: number;
  joined: boolean;
}

export interface Profile {
  id: number;
  name: string;
  login: string | null;
  avatar_url: string | null;
  bio: string | null;
  status_text: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  posts_count: number;
}

export interface CommunityPost {
  id: number;
  text: string | null;
  media_url: string | null;
  created_at: string;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
}

export interface BlockedUser {
  id: number;
  name: string;
  avatar_url: string | null;
}

export const api = {
  listChats: (): Promise<{ chats: Chat[] }> =>
    req(`${CHATS_URL}?action=list-chats`, "GET"),

  getMessages: (chatId: number): Promise<{ messages: Message[]; me: number }> =>
    req(`${CHATS_URL}?action=get-messages&chat_id=${chatId}`, "GET"),

  sendMessage: (payload: {
    chat_id: number;
    type?: string;
    text?: string;
    media_url?: string;
    media_meta?: Record<string, unknown>;
    reply_to?: number;
  }): Promise<{ id: number; created_at: string }> =>
    req(`${CHATS_URL}?action=send-message`, "POST", payload),

  createChat: (payload: {
    type: string;
    user_id?: number;
    title?: string;
    members?: number[];
  }): Promise<{ chat_id: number; existing: boolean }> =>
    req(`${CHATS_URL}?action=create-chat`, "POST", payload),

  editMessage: (messageId: number, text: string): Promise<{ ok: boolean }> =>
    req(`${CHATS_URL}?action=edit-message`, "POST", { message_id: messageId, text }),

  deleteMessage: (messageId: number): Promise<{ ok: boolean }> =>
    req(`${CHATS_URL}?action=delete-message`, "POST", { message_id: messageId }),

  searchUsers: (q: string): Promise<{ users: SearchUser[] }> =>
    req(`${CHATS_URL}?action=search-users&q=${encodeURIComponent(q)}`, "GET"),

  markRead: (chatId: number, lastId: number): Promise<{ ok: boolean }> =>
    req(`${CHATS_URL}?action=mark-read`, "POST", { chat_id: chatId, last_message_id: lastId }),

  react: (messageId: number, emoji: string): Promise<{ ok: boolean }> =>
    req(`${CHATS_URL}?action=react`, "POST", { message_id: messageId, emoji }),

  uploadMedia: (data: string, contentType: string, folder = "media"): Promise<{ url: string; size: number }> =>
    req(`${MEDIA_URL}`, "POST", { data, content_type: contentType, folder }),

  listStories: (): Promise<{ stories: unknown[]; me: number }> =>
    req(`${STORIES_URL}?action=list`, "GET"),

  userStories: (userId: number): Promise<{ items: unknown[] }> =>
    req(`${STORIES_URL}?action=user-stories&user_id=${userId}`, "GET"),

  createStory: (payload: { type?: string; media_url?: string; caption?: string; bg_color?: string }): Promise<{ id: number }> =>
    req(`${STORIES_URL}?action=create`, "POST", payload),

  viewStory: (storyId: number): Promise<{ ok: boolean }> =>
    req(`${STORIES_URL}?action=view`, "POST", { story_id: storyId }),

  me: (): Promise<{ user: { id: number; phone: string; name: string; avatar_url: string | null } }> =>
    req(`${AUTH_URL}?action=me`, "GET"),

  feedList: (): Promise<{ posts: Post[]; me: number }> =>
    req(`${SOCIAL_URL}?action=feed-list`, "GET"),

  feedCreate: (payload: { text?: string; media_url?: string }): Promise<{ id: number; created_at: string }> =>
    req(`${SOCIAL_URL}?action=feed-create`, "POST", payload),

  feedLike: (postId: number): Promise<{ liked: boolean; likes: number }> =>
    req(`${SOCIAL_URL}?action=feed-like`, "POST", { post_id: postId }),

  communitiesList: (type?: "group" | "channel"): Promise<{ communities: Community[] }> =>
    req(`${SOCIAL_URL}?action=communities-list${type ? `&type=${type}` : ""}`, "GET"),

  communityCreate: (payload: {
    type: "group" | "channel";
    title: string;
    description?: string;
    avatar_url?: string;
  }): Promise<{ id: number }> =>
    req(`${SOCIAL_URL}?action=community-create`, "POST", payload),

  communityJoin: (id: number): Promise<{ ok: boolean; joined: boolean }> =>
    req(`${SOCIAL_URL}?action=community-join`, "POST", { community_id: id }),

  communityLeave: (id: number): Promise<{ ok: boolean; joined: boolean }> =>
    req(`${SOCIAL_URL}?action=community-leave`, "POST", { community_id: id }),

  profileGet: (userId?: number): Promise<{ user: Profile; posts: Post[]; is_me: boolean; is_blocked: boolean }> =>
    req(`${SOCIAL_URL}?action=profile-get${userId ? `&user_id=${userId}` : ""}`, "GET"),

  communityPosts: (communityId: number): Promise<{ posts: CommunityPost[]; me: number }> =>
    req(`${SOCIAL_URL}?action=community-posts&community_id=${communityId}`, "GET"),

  communityPostCreate: (payload: { community_id: number; text?: string; media_url?: string }): Promise<{ id: number; created_at: string }> =>
    req(`${SOCIAL_URL}?action=community-post-create`, "POST", payload),

  communityPostDelete: (postId: number): Promise<{ ok: boolean }> =>
    req(`${SOCIAL_URL}?action=community-post-delete`, "POST", { post_id: postId }),

  communityDetail: (id: number): Promise<{ community: Community }> =>
    req(`${SOCIAL_URL}?action=community-detail&id=${id}`, "GET"),

  blockToggle: (userId: number): Promise<{ blocked: boolean }> =>
    req(`${SOCIAL_URL}?action=block-toggle`, "POST", { user_id: userId }),

  blocksList: (): Promise<{ blocked: BlockedUser[] }> =>
    req(`${SOCIAL_URL}?action=blocks-list`, "GET"),

  profileUpdate: (payload: {
    name?: string;
    bio?: string;
    status_text?: string;
    avatar_url?: string;
  }): Promise<{ user: Profile }> =>
    req(`${SOCIAL_URL}?action=profile-update`, "POST", payload),

  statusPing: (): Promise<{ ok: boolean }> =>
    req(`${SOCIAL_URL}?action=status-ping`, "GET"),

  videoFeed: (): Promise<{ posts: Post[]; me: number }> =>
    req(`${SOCIAL_URL}?action=video-feed`, "GET"),

  commentsList: (postId: number): Promise<{ comments: Comment[]; me: number }> =>
    req(`${SOCIAL_URL}?action=comments-list&post_id=${postId}`, "GET"),

  commentAdd: (postId: number, text: string): Promise<{ id: number; created_at: string }> =>
    req(`${SOCIAL_URL}?action=comment-add`, "POST", { post_id: postId, text }),

  commentDelete: (commentId: number): Promise<{ ok: boolean }> =>
    req(`${SOCIAL_URL}?action=comment-delete`, "POST", { comment_id: commentId }),

  callStart: (payload: { callee_id: number; call_type: "audio" | "video"; offer_sdp: string }): Promise<{ call_id: number }> =>
    req(`${SOCIAL_URL}?action=call-start`, "POST", payload),

  callIncoming: (): Promise<{ call: IncomingCall | null }> =>
    req(`${SOCIAL_URL}?action=call-incoming`, "GET"),

  callAnswer: (callId: number, answerSdp: string): Promise<{ ok: boolean }> =>
    req(`${SOCIAL_URL}?action=call-answer`, "POST", { call_id: callId, answer_sdp: answerSdp }),

  callPoll: (callId: number): Promise<{ status: string; answer_sdp: string | null }> =>
    req(`${SOCIAL_URL}?action=call-poll&call_id=${callId}`, "GET"),

  callEnd: (callId: number): Promise<{ ok: boolean }> =>
    req(`${SOCIAL_URL}?action=call-end`, "POST", { call_id: callId }),

  callIceAdd: (callId: number, candidate: RTCIceCandidateInit): Promise<{ ok: boolean }> =>
    req(`${SOCIAL_URL}?action=call-ice-add`, "POST", { call_id: callId, candidate }),

  callIceGet: (callId: number, after: number): Promise<{ candidates: { id: number; candidate: string }[] }> =>
    req(`${SOCIAL_URL}?action=call-ice-get&call_id=${callId}&after=${after}`, "GET"),
};

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}