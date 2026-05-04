pub mod audit;
pub mod credential;
pub mod notification;
pub mod permission;
pub mod repository;
pub mod ticket;

// Convenience re-exports for the most commonly used types
pub use audit::{AuditAction, AuditActor, AuditLogEntry};
pub use credential::{IntegrationCredential, Provider};
pub use notification::{NotificationChannel, NotificationFilter, NotificationRule};
pub use permission::{permissions_for_role, role_has_permission, Permission, Role};
pub use repository::{IndexStatus, RepositoryContext};
pub use ticket::{JiraTicket, TicketPriority, TicketReviewRequest, TicketStatus};
