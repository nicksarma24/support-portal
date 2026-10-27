export type Role = "ADMIN" | "USER";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface UserRef { id: string; name: string; email: string }
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  creatorId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  creator: UserRef;
  assignee: UserRef | null;
}
export interface TicketComment {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
  createdAt: string;
  author: { id: string; name: string; role: Role };
}
