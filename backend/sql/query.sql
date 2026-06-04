-- name: CreateUser :one
INSERT INTO users (username, password_hash, full_name, role, photo_url, email)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUserByUsername :one
SELECT * FROM users
WHERE username = $1 AND deleted_at IS NULL LIMIT 1;

-- name: GetUserById :one
SELECT * FROM users
WHERE id = $1 AND deleted_at IS NULL LIMIT 1;

-- name: GetUserPasswordHash :one
SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL;

-- name: ListUsers :many
SELECT * FROM users
WHERE deleted_at IS NULL AND role = 'peserta'
  AND (sqlc.arg('search')::text = '' OR full_name ILIKE '%' || sqlc.arg('search')::text || '%' OR email ILIKE '%' || sqlc.arg('search')::text || '%')
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountUsers :one
SELECT COUNT(*) FROM users
WHERE deleted_at IS NULL AND role = 'peserta'
  AND (sqlc.arg('search')::text = '' OR full_name ILIKE '%' || sqlc.arg('search')::text || '%' OR email ILIKE '%' || sqlc.arg('search')::text || '%');

-- name: ListAdmins :many
SELECT * FROM users
WHERE deleted_at IS NULL AND role = 'admin'
  AND (sqlc.arg('search')::text = '' OR full_name ILIKE '%' || sqlc.arg('search')::text || '%')
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountAdmins :one
SELECT COUNT(*) FROM users
WHERE deleted_at IS NULL AND role = 'admin'
  AND (sqlc.arg('search')::text = '' OR full_name ILIKE '%' || sqlc.arg('search')::text || '%');

-- name: UpdateUser :one
UPDATE users
SET username = $2, full_name = $3, role = $4, photo_url = $5, email = $6, email_notifications = $7
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = $2
WHERE id = $1 AND deleted_at IS NULL;

-- name: DeleteUser :exec
UPDATE users
SET deleted_at = NOW()
WHERE id = $1;

-- name: CreateCategory :one
INSERT INTO categories (name)
VALUES ($1)
RETURNING *;

-- name: GetCategoryById :one
SELECT * FROM categories
WHERE id = $1 AND deleted_at IS NULL LIMIT 1;

-- name: ListCategories :many
SELECT * FROM categories
WHERE deleted_at IS NULL AND (sqlc.arg('search')::text = '' OR name ILIKE '%' || sqlc.arg('search')::text || '%')
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountCategories :one
SELECT COUNT(*) FROM categories
WHERE deleted_at IS NULL AND (sqlc.arg('search')::text = '' OR name ILIKE '%' || sqlc.arg('search')::text || '%');

-- name: UpdateCategory :one
UPDATE categories
SET name = $2
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteCategory :exec
UPDATE categories
SET deleted_at = NOW()
WHERE id = $1;

-- name: GetCategoryByName :one
SELECT * FROM categories
WHERE name ILIKE $1 AND deleted_at IS NULL LIMIT 1;

-- name: CountQuestionsByCategory :one
SELECT COUNT(*) FROM questions
WHERE category_id = $1;

-- name: CreateQuestion :one
INSERT INTO questions (category_id, question_text, option_a, option_b, option_c, option_d, correct_answer, weight)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: CheckQuestionDuplicate :one
SELECT EXISTS(
    SELECT 1 FROM questions q
    JOIN categories c ON q.category_id = c.id
    WHERE c.deleted_at IS NULL AND q.deleted_at IS NULL
    AND LOWER(TRIM(q.question_text)) = LOWER(TRIM(sqlc.arg('question_text')::text))
    AND (sqlc.narg('exclude_id')::uuid IS NULL OR q.id <> sqlc.narg('exclude_id')::uuid)
);

-- name: GetQuestionById :one
SELECT * FROM questions
WHERE id = $1 AND deleted_at IS NULL LIMIT 1;

-- name: ListQuestions :many
SELECT q.* FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE q.deleted_at IS NULL AND c.deleted_at IS NULL
  AND (sqlc.narg('category_id')::int IS NULL OR q.category_id = sqlc.narg('category_id')::int)
  AND (sqlc.arg('search')::text = '' OR to_tsvector('indonesian', q.question_text) @@ plainto_tsquery('indonesian', sqlc.arg('search')::text))
ORDER BY q.category_id ASC, q.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountQuestions :one
SELECT COUNT(*) FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE q.deleted_at IS NULL AND c.deleted_at IS NULL
  AND (sqlc.narg('category_id')::int IS NULL OR q.category_id = sqlc.narg('category_id')::int)
  AND (sqlc.arg('search')::text = '' OR to_tsvector('indonesian', q.question_text) @@ plainto_tsquery('indonesian', sqlc.arg('search')::text));

-- name: UpdateQuestion :one
UPDATE questions
SET category_id = $2, question_text = $3, option_a = $4, option_b = $5, option_c = $6, option_d = $7, correct_answer = $8, weight = $9
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteQuestion :exec
UPDATE questions
SET deleted_at = NOW()
WHERE id = $1;

-- name: CreateEvent :one
INSERT INTO events (name, start_time, end_time, duration_minutes, passing_grade)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetEventById :one
SELECT e.*, (SELECT COUNT(*)::int FROM event_questions eq WHERE eq.event_id = e.id) as total_questions
FROM events e
WHERE e.id = $1 AND e.deleted_at IS NULL LIMIT 1;

-- name: ListEvents :many
SELECT e.*, (SELECT COUNT(*)::int FROM event_questions eq WHERE eq.event_id = e.id) as total_questions
FROM events e
WHERE e.deleted_at IS NULL AND (sqlc.arg('search')::text = '' OR to_tsvector('indonesian', e.name) @@ plainto_tsquery('indonesian', sqlc.arg('search')::text))
ORDER BY e.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountEvents :one
SELECT COUNT(*) FROM events
WHERE deleted_at IS NULL AND (sqlc.arg('search')::text = '' OR to_tsvector('indonesian', name) @@ plainto_tsquery('indonesian', sqlc.arg('search')::text));

-- name: UpdateEvent :one
UPDATE events
SET name = $2, start_time = $3, end_time = $4, duration_minutes = $5, passing_grade = $6
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteEvent :exec
UPDATE events
SET deleted_at = NOW()
WHERE id = $1;

-- name: DeleteApprovalsByEventID :exec
DELETE FROM user_event_approvals WHERE event_id = $1;

-- name: ListAllEventParticipants :many
SELECT u.id, u.username, u.full_name, u.email, uea.id as approval_id
FROM users u
JOIN user_event_approvals uea ON u.id = uea.user_id
WHERE uea.event_id = $1;


-- name: EnrollUserToEvent :one
INSERT INTO user_event_approvals (user_id, event_id, status)
VALUES ($1, $2, 'pending')
RETURNING *;

-- name: ApproveUserEvent :one
UPDATE user_event_approvals
SET status = 'approved', updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SaveUserAnswer :one
INSERT INTO user_answers (approval_id, question_id, selected_answer, is_correct)
VALUES ($1, $2, $3, $4)
ON CONFLICT (approval_id, question_id) 
DO UPDATE SET 
    selected_answer = EXCLUDED.selected_answer, 
    is_correct = EXCLUDED.is_correct
RETURNING *;

-- name: CreateSession :one
INSERT INTO sessions (id, user_id, refresh_token, is_blocked, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetSession :one
SELECT * FROM sessions
WHERE id = $1 LIMIT 1;

-- name: BlockSession :exec
UPDATE sessions
SET is_blocked = true
WHERE id = $1;

-- name: CreateEventQuestion :exec
INSERT INTO event_questions (event_id, question_id)
VALUES ($1, $2);

-- name: ListEventQuestions :many
SELECT q.* FROM questions q
JOIN event_questions eq ON q.id = eq.question_id
WHERE eq.event_id = $1
ORDER BY q.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountEventQuestions :one
SELECT COUNT(*) FROM event_questions
WHERE event_id = $1;

-- name: DeleteEventQuestion :exec
DELETE FROM event_questions
WHERE event_id = $1 AND question_id = $2;

-- name: ListEventParticipants :many
SELECT u.id, u.username, u.full_name, uea.id as approval_id, uea.status, uea.is_completed, uea.score, uea.is_passed
FROM users u
JOIN user_event_approvals uea ON u.id = uea.user_id
WHERE uea.event_id = $1
  AND (sqlc.arg('search')::text = '' OR u.username ILIKE '%' || sqlc.arg('search')::text || '%' OR u.full_name ILIKE '%' || sqlc.arg('search')::text || '%')
ORDER BY uea.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountEventParticipants :one
SELECT COUNT(*) FROM user_event_approvals uea
JOIN users u ON u.id = uea.user_id
WHERE uea.event_id = $1
  AND (sqlc.arg('search')::text = '' OR u.username ILIKE '%' || sqlc.arg('search')::text || '%' OR u.full_name ILIKE '%' || sqlc.arg('search')::text || '%');

-- name: ListUpcomingEvents :many
SELECT e.*, (SELECT COUNT(*)::int FROM event_questions eq WHERE eq.event_id = e.id) as total_questions
FROM events e
WHERE e.end_time > NOW() AND e.deleted_at IS NULL
ORDER BY e.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountUpcomingEvents :one
SELECT COUNT(*) FROM events
WHERE end_time > NOW() AND deleted_at IS NULL;

-- name: ListUserApprovals :many
SELECT e.id, e.name, e.start_time, e.end_time, e.duration_minutes, e.passing_grade, 
       (SELECT COUNT(question_id)::int FROM event_questions eq WHERE eq.event_id = e.id) as question_count,
       uea.id as approval_id, uea.status, uea.is_completed, uea.score, uea.is_passed, uea.started_at, uea.completed_at
FROM events e
JOIN user_event_approvals uea ON e.id = uea.event_id
WHERE uea.user_id = $1
ORDER BY e.start_time DESC
LIMIT $2 OFFSET $3;

-- name: CountUserApprovals :one
SELECT COUNT(*) FROM user_event_approvals
WHERE user_id = $1;

-- name: GetApprovalStatus :one
SELECT uea.*, e.start_time, e.end_time, e.passing_grade,
       (SELECT COUNT(question_id)::int FROM event_questions eq WHERE eq.event_id = e.id) as question_count
FROM user_event_approvals uea
JOIN events e ON uea.event_id = e.id
WHERE uea.user_id = $1 AND uea.event_id = $2 LIMIT 1;

-- name: CalculateScore :one
SELECT COALESCE(SUM(q.weight), 0)::numeric as total_score
FROM user_answers ua
JOIN questions q ON ua.question_id = q.id
WHERE ua.approval_id = $1 AND ua.is_correct = true;

-- name: FinishExam :exec
UPDATE user_event_approvals
SET is_completed = true, completed_at = NOW(), score = $2, is_passed = $3, updated_at = NOW()
WHERE id = $1;

-- name: GetEventTotalWeight :one
SELECT COALESCE(SUM(q.weight), 0)::numeric as total_weight
FROM event_questions eq
JOIN questions q ON eq.question_id = q.id
WHERE eq.event_id = $1;

-- name: CountAvailableQuestionsForEventByCategory :one
SELECT COUNT(*) FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE q.category_id = $2 AND c.deleted_at IS NULL AND q.deleted_at IS NULL
  AND q.id NOT IN (SELECT question_id FROM event_questions WHERE event_id = $1);

-- name: CountAvailableQuestionsForEventAll :one
SELECT COUNT(*) FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE c.deleted_at IS NULL AND q.deleted_at IS NULL
  AND q.id NOT IN (SELECT question_id FROM event_questions WHERE event_id = $1);

-- name: AddRandomEventQuestionsByCategory :exec
INSERT INTO event_questions (event_id, question_id)
SELECT $1, q.id
FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE q.category_id = $2 AND c.deleted_at IS NULL AND q.deleted_at IS NULL
  AND q.id NOT IN (SELECT question_id FROM event_questions WHERE event_id = $1)
ORDER BY RANDOM()
LIMIT $3;

-- name: AddRandomEventQuestionsAll :exec
INSERT INTO event_questions (event_id, question_id)
SELECT $1, q.id
FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE c.deleted_at IS NULL AND q.deleted_at IS NULL
  AND q.id NOT IN (SELECT question_id FROM event_questions WHERE event_id = $1)
ORDER BY RANDOM()
LIMIT $2;

-- name: GetUserAnswersDetail :many
SELECT
    ua.id as answer_id,
    ua.selected_answer,
    ua.is_correct,
    q.id as question_id,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.correct_answer,
    q.weight
FROM user_answers ua
JOIN questions q ON ua.question_id = q.id
WHERE ua.approval_id = $1;

-- name: GetAllEventParticipantsForExport :many
SELECT u.username, u.full_name, uea.status, uea.is_completed, uea.score, uea.is_passed, uea.started_at, uea.completed_at
FROM users u
JOIN user_event_approvals uea ON u.id = uea.user_id
WHERE uea.event_id = $1
ORDER BY uea.created_at DESC;

-- name: SetStartedAt :exec
UPDATE user_event_approvals SET started_at = NOW(), updated_at = NOW() WHERE id = $1 AND started_at IS NULL;

-- name: RevokeUserEvent :one
UPDATE user_event_approvals
SET status = 'revoked', updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetApprovalById :one
SELECT * FROM user_event_approvals WHERE id = $1;

-- name: UpdateUserPhoto :exec
UPDATE users SET photo_url = $2 WHERE id = $1;

-- name: CheckDuplicateQuestion :one
SELECT q.* FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE c.deleted_at IS NULL AND q.deleted_at IS NULL
  AND REGEXP_REPLACE(q.question_text, '^[[:space:][:digit:].)*#_-]+', '') ILIKE REGEXP_REPLACE(sqlc.arg('question_text')::text, '^[[:space:][:digit:].)*#_-]+', '')
  AND (sqlc.narg('exclude_id')::uuid IS NULL OR q.id <> sqlc.narg('exclude_id')::uuid)
LIMIT 1;

-- name: CheckDuplicateEvent :one
SELECT * FROM events
WHERE deleted_at IS NULL AND name = $1 AND start_time = $2 AND end_time = $3
  AND (sqlc.narg('exclude_id')::uuid IS NULL OR id <> sqlc.narg('exclude_id')::uuid)
LIMIT 1;

-- name: GetTotalParticipantsDashboard :one
SELECT COUNT(*) FROM users
WHERE role = 'peserta' AND deleted_at IS NULL;

-- name: GetTotalQuestionsDashboard :one
SELECT COUNT(*) FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE q.deleted_at IS NULL AND c.deleted_at IS NULL;

-- name: GetTotalActiveEventsDashboard :one
SELECT COUNT(*) FROM events
WHERE end_time > NOW() AND deleted_at IS NULL;

-- name: GetTotalCompletedExamsDashboard :one
SELECT COUNT(*) FROM user_event_approvals
WHERE is_completed = true;

-- name: GetRecentActivitiesDashboard :many
SELECT
    u.full_name as user_name,
    u.photo_url as user_photo_url,
    e.name as event_name,
    uea.status,
    uea.is_completed,
    uea.score,
    COALESCE(uea.updated_at, uea.created_at) as activity_time,
    e.end_time as event_end_time
FROM user_event_approvals uea
JOIN users u ON uea.user_id = u.id
JOIN events e ON uea.event_id = e.id
ORDER BY COALESCE(uea.updated_at, uea.created_at) DESC NULLS LAST
LIMIT 5;

-- name: GetAllActivitiesDashboard :many
SELECT
    u.full_name as user_name,
    u.photo_url as user_photo_url,
    e.name as event_name,
    uea.status,
    uea.is_completed,
    uea.score,
    COALESCE(uea.updated_at, uea.created_at) as activity_time,
    e.end_time as event_end_time
FROM user_event_approvals uea
JOIN users u ON uea.user_id = u.id
JOIN events e ON uea.event_id = e.id
ORDER BY COALESCE(uea.updated_at, uea.created_at) DESC NULLS LAST
LIMIT $1 OFFSET $2;

-- name: CountAllActivitiesDashboard :one
SELECT COUNT(*) 
FROM user_event_approvals uea;
-- name: DeleteUserEventApproval :exec
DELETE FROM user_event_approvals WHERE id = $1;

-- name: CreateNotification :one
INSERT INTO notifications (user_id, title, message, type)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserNotifications :many
SELECT * FROM notifications 
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1 AND is_read = FALSE;

-- name: MarkNotificationAsRead :exec
UPDATE notifications
SET is_read = TRUE
WHERE id = $1 AND user_id = $2;

-- name: MarkAllNotificationsAsRead :exec
UPDATE notifications
SET is_read = TRUE
WHERE user_id = $1 AND is_read = FALSE;

-- name: GetExpiredEvents :many
SELECT * FROM events
WHERE end_time < NOW() AND deleted_at IS NULL;

-- name: DeleteNotificationsByMessageLike :exec
DELETE FROM notifications
WHERE type IN ('event_approval', 'event_revocation')
AND message ILIKE '%' || sqlc.arg('event_name') || '%';
