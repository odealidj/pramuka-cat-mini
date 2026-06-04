package integration

import (
	"context"
	"database/sql"
	"log"
	"os"
	"testing"

	"github.com/redis/go-redis/v9"
	"github.com/hibiken/asynq"
	"github.com/labstack/echo/v4"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/handler"
	appMiddleware "github.com/odealidj/pramuka-CAT/backend/internal/adapters/middleware"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/services"
	"github.com/odealidj/pramuka-CAT/backend/internal/worker"
	"github.com/odealidj/pramuka-CAT/backend/pkg/database"
	"github.com/odealidj/pramuka-CAT/backend/pkg/sse"
)

var (
	testDB      *sql.DB
	testRedis   *redis.Client
	queries     *sqlcgen.Queries
	testEchoApp *echo.Echo
)

func TestMain(m *testing.M) {
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_PORT", "5432")
	os.Setenv("DB_USER", "POSTGRES_USER")
	os.Setenv("DB_PASSWORD", "POSTGRES_PASSWORD")
	os.Setenv("DB_NAME", "pramukacat_test")
	os.Setenv("DB_SSLMODE", "disable")

	os.Setenv("REDIS_HOST", "localhost")
	os.Setenv("REDIS_PORT", "6379")
	os.Setenv("REDIS_PASSWORD", "")
	os.Setenv("REDIS_DB", "1")
	os.Setenv("JWT_ACCESS_SECRET", "test_access_secret")
	os.Setenv("JWT_REFRESH_SECRET", "test_refresh_secret")

	var err error
	testDB, err = database.ConnectPostgres()
	if err != nil { log.Fatalf("DB error: %v", err) }
	defer testDB.Close()

	testRedis, err = database.ConnectRedis()
	if err != nil { log.Fatalf("Redis error: %v", err) }
	defer testRedis.Close()

	queries = sqlcgen.New(testDB)
	testRedis.FlushDB(context.Background())

	redisOpt := asynq.RedisClientOpt{
		Addr:     "localhost:6379",
		Password: "",
		DB:       1,
	}
	taskDistributor := worker.NewRedisTaskDistributor(redisOpt)
	sseBroker := sse.NewBroker(testRedis)

	authRepo := repository.NewAuthRepository(queries)
	authCache := repository.NewAuthCache(testRedis)
	userRepo := repository.NewUserRepository(queries)
	userCache := repository.NewUserCache(testRedis)
	categoryRepo := repository.NewCategoryRepository(queries)
	questionRepo := repository.NewQuestionRepository(queries)
	eventRepo := repository.NewEventRepository(queries)
	examRepo := repository.NewExamRepository(queries)
	examCache := repository.NewExamCache(testRedis)

	authService := services.NewAuthService(authRepo, authCache)
	userService := services.NewUserService(userRepo, userCache)
	categoryService := services.NewCategoryService(categoryRepo)
	questionService := services.NewQuestionService(questionRepo, categoryRepo)
	eventService := services.NewEventService(eventRepo, taskDistributor)
	examService := services.NewExamService(examRepo, examCache, taskDistributor)

	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService)
	categoryHandler := handler.NewCategoryHandler(categoryService)
	questionHandler := handler.NewQuestionHandler(questionService)
	eventHandler := handler.NewEventHandler(eventService, sseBroker)
	examHandler := handler.NewExamHandler(examService, sseBroker)

	testEchoApp = echo.New()
	api := testEchoApp.Group("/api/v1")
	authHandler.RegisterRoutes(api)
	
	protected := api.Group("/protected")
	protected.Use(appMiddleware.RequireAuth(authCache))
	
	userHandler.RegisterParticipantRoutes(protected)
	examHandler.RegisterParticipantRoutes(protected)

	adminGroup := protected.Group("/admin")
	adminGroup.Use(appMiddleware.RequireRole("admin", "super_admin"))
	categoryHandler.RegisterAdminRoutes(adminGroup)
	questionHandler.RegisterAdminRoutes(adminGroup)
	eventHandler.RegisterAdminRoutes(adminGroup)

	code := m.Run()
	os.Exit(code)
}

func clearDatabase() {
	_, err := testDB.Exec(`
		TRUNCATE TABLE users, categories CASCADE;
	`)
	if err != nil { log.Fatalf("Truncate error: %v", err) }
	testRedis.FlushDB(context.Background())
}
