import { supabase } from "@/lib/supabase";
import type { ChannelPlatform, ConversationStatus, PresenceStatus, VaultPlatform } from "@/types";

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");
  return user.id;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  senderName: string
): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender: "staff",
    sender_name: senderName,
    staff_id: userId,
    content,
    type: "text",
    status: "sent",
    sent_at: now,
  });
  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ last_message: content, last_message_at: now, status: "answered" })
    .eq("id", conversationId);
}

export async function assignConversation(
  conversationId: string,
  staffId: string
): Promise<void> {
  const { error } = await supabase
    .from("conversation_assignments")
    .insert({ conversation_id: conversationId, staff_id: staffId, assigned_at: new Date().toISOString() });
  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ assigned_staff_id: staffId, status: "processing" })
    .eq("id", conversationId);
}

export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  const { error } = await supabase.from("conversations").update({ status }).eq("id", conversationId);
  if (error) throw error;
}

export async function addInternalNote(conversationId: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("internal_notes")
    .insert({ conversation_id: conversationId, author_id: userId, content });
  if (error) throw error;
}

export async function updatePresence(presence: PresenceStatus): Promise<void> {
  const userId = await requireUserId();
  await supabase
    .from("profiles")
    .update({ presence, last_active: new Date().toISOString() })
    .eq("id", userId);
}

interface ManageUsersPayload {
  action: "create_user" | "reset_password" | "set_active" | "revoke_sessions";
  username?: string;
  name?: string;
  password?: string;
  role?: "admin" | "staff";
  channelIds?: string[];
  userId?: string;
  active?: boolean;
}

export async function callManageUsers(payload: ManageUsersPayload): Promise<{ ok?: boolean }> {
  const { data, error } = await supabase.functions.invoke("manage-users", { body: payload });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error as string);
  return data as { ok?: boolean };
}

export async function setStaffChannels(userId: string, channelIds: string[]): Promise<void> {
  const { error: delError } = await supabase.from("channel_access").delete().eq("user_id", userId);
  if (delError) throw delError;
  if (channelIds.length > 0) {
    const rows = channelIds.map((channel_id) => ({ user_id: userId, channel_id }));
    const { error: insError } = await supabase.from("channel_access").insert(rows);
    if (insError) throw insError;
  }
}

export async function transferStaffData(fromId: string, toId: string): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ assigned_staff_id: toId })
    .eq("assigned_staff_id", fromId);
  if (error) throw error;
}

export async function renameStaff(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
  if (error) throw error;
}

export async function createChannel(
  name: string,
  platform: ChannelPlatform,
  externalId?: string
): Promise<void> {
  const { error } = await supabase.from("channels").insert({
    name,
    platform,
    external_id: externalId ?? null,
    status: platform === "tiktok" ? "pending" : "connected",
  });
  if (error) throw error;
}

export async function deleteChannel(channelId: string): Promise<void> {
  const { error } = await supabase.from("channels").delete().eq("id", channelId);
  if (error) throw error;
}

export async function updateChannel(
  channelId: string,
  name: string,
  externalId?: string
): Promise<void> {
  const { error } = await supabase
    .from("channels")
    .update({ name, external_id: externalId ?? null })
    .eq("id", channelId);
  if (error) throw error;
}

export async function createTeamRoom(
  name: string,
  description: string,
  memberIds: string[]
): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("team_rooms")
    .insert({ name, description: description || null, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  const roomId = data.id as string;
  const allMembers = Array.from(new Set([...memberIds, userId]));
  const rows = allMembers.map((user_id) => ({ room_id: roomId, user_id }));
  const { error: mErr } = await supabase.from("team_room_members").insert(rows);
  if (mErr) throw mErr;
}

export async function deleteTeamRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from("team_rooms").delete().eq("id", roomId);
  if (error) throw error;
}

export async function addTeamMembers(roomId: string, memberIds: string[]): Promise<void> {
  const rows = memberIds.map((user_id) => ({ room_id: roomId, user_id }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("team_room_members").insert(rows);
  if (error) throw error;
}

export async function sendTeamMessage(roomId: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("team_messages")
    .insert({ room_id: roomId, sender_id: userId, content, sent_at: new Date().toISOString() });
  if (error) throw error;
}

export interface CustomerNoteInput {
  isRegistered: boolean;
  accountName: string;
  contactInfo: string;
  totalDeposit: number;
  totalBet: number;
  note: string;
}

export async function upsertCustomerNote(
  customerId: string,
  input: CustomerNoteInput
): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const { error } = await supabase.from("customer_notes").upsert(
    {
      customer_id: customerId,
      is_registered: input.isRegistered,
      account_name: input.accountName,
      contact_info: input.contactInfo,
      total_deposit: input.totalDeposit,
      total_bet: input.totalBet,
      note: input.note,
      updated_by: userId,
      updated_at: now,
    },
    { onConflict: "customer_id" }
  );
  if (error) throw error;
}

export interface AccountVaultInput {
  platform: VaultPlatform;
  label: string;
  username: string;
  password: string;
  email: string;
  twoFa: string;
  note: string;
}

export async function createAccountVault(input: AccountVaultInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("account_vault").insert({
    platform: input.platform,
    label: input.label,
    username: input.username,
    password: input.password,
    email: input.email,
    two_fa: input.twoFa,
    note: input.note,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateAccountVault(id: string, input: AccountVaultInput): Promise<void> {
  const { error } = await supabase
    .from("account_vault")
    .update({
      platform: input.platform,
      label: input.label,
      username: input.username,
      password: input.password,
      email: input.email,
      two_fa: input.twoFa,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAccountVault(id: string): Promise<void> {
  const { error } = await supabase.from("account_vault").delete().eq("id", id);
  if (error) throw error;
}

export interface EvaluationInput {
  staffId: string;
  staffName: string;
  rating: number;
  title: string;
  comment: string;
}

export async function createEvaluation(input: EvaluationInput): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const { error: evalError } = await supabase.from("staff_evaluations").insert({
    staff_id: input.staffId,
    evaluator_id: userId,
    rating: input.rating,
    title: input.title,
    comment: input.comment,
    created_at: now,
  });
  if (evalError) throw evalError;

  const { error: ntfError } = await supabase.from("notifications").insert({
    user_id: input.staffId,
    type: "evaluation",
    title: "Bạn vừa nhận một đánh giá mới",
    content: `Điểm ${input.rating}/5 — ${input.title || "Không tiêu đề"}`,
    created_at: now,
  });
  if (ntfError) throw ntfError;
}

export async function deleteEvaluation(id: string): Promise<void> {
  const { error } = await supabase.from("staff_evaluations").delete().eq("id", id);
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export interface CustomerAccountInput {
  customerName: string;
  registrationDate?: string;
  lastDepositDate?: string;
  totalDeposit: number;
  totalBet: number;
  meetsTarget: boolean;
  contactInfo: string;
  note: string;
}

export async function createCustomerAccount(input: CustomerAccountInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("customer_accounts").insert({
    customer_name: input.customerName,
    registration_date: input.registrationDate || null,
    last_deposit_date: input.lastDepositDate || null,
    total_deposit: input.totalDeposit,
    total_bet: input.totalBet,
    meets_target: input.meetsTarget,
    contact_info: input.contactInfo,
    note: input.note,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateCustomerAccount(id: string, input: CustomerAccountInput): Promise<void> {
  const { error } = await supabase
    .from("customer_accounts")
    .update({
      customer_name: input.customerName,
      registration_date: input.registrationDate || null,
      last_deposit_date: input.lastDepositDate || null,
      total_deposit: input.totalDeposit,
      total_bet: input.totalBet,
      meets_target: input.meetsTarget,
      contact_info: input.contactInfo,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCustomerAccount(id: string): Promise<void> {
  const { error } = await supabase.from("customer_accounts").delete().eq("id", id);
  if (error) throw error;
}