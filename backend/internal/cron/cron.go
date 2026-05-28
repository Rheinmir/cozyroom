package cron

import (
	"database/sql"
	"log"
	"time"

	"cozyroom/internal/api"
	"github.com/robfig/cron/v3"
)

type CronManager struct {
	db         *sql.DB
	cron       *cron.Cron
	aiHandlers *api.AIHandlers
}

type ScheduledTask struct {
	ID             string
	CronExpression string
	Prompt         string
	LastRunAt      string
	CreatedAt      string
}

func NewCronManager(db *sql.DB, aiHandlers *api.AIHandlers) *CronManager {
	return &CronManager{
		db:         db,
		cron:       cron.New(),
		aiHandlers: aiHandlers,
	}
}

func (m *CronManager) Start() error {
	m.cron.Start()
	log.Println("[Cron] Background task scheduler started")
	return m.LoadAndScheduleAll()
}

func (m *CronManager) Stop() {
	m.cron.Stop()
	log.Println("[Cron] Background task scheduler stopped")
}

func (m *CronManager) LoadAndScheduleAll() error {
	// Stop existing cron jobs and re-init to sync any changes
	m.cron.Stop()
	m.cron = cron.New()
	m.cron.Start()

	rows, err := m.db.Query(`SELECT id, cron_expression, prompt, last_run_at, created_at FROM scheduled_tasks`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var t ScheduledTask
		if err := rows.Scan(&t.ID, &t.CronExpression, &t.Prompt, &t.LastRunAt, &t.CreatedAt); err != nil {
			log.Printf("[Cron] Error scanning task: %v", err)
			continue
		}

		task := t // Capture loop variable
		_, err := m.cron.AddFunc(task.CronExpression, func() {
			log.Printf("[Cron] Executing task %s: %q", task.ID, task.Prompt)
			
			// Execute through AI Agent Runtime!
			// session_id is "cron_" + task.ID
			resText, _, err := m.aiHandlers.ExecutePrompt("cron_"+task.ID, task.Prompt, nil, "")
			if err != nil {
				log.Printf("[Cron] Error executing task %s: %v", task.ID, err)
				return
			}
			log.Printf("[Cron] Task %s executed successfully. AI Response: %q", task.ID, resText)

			// Update last run at
			nowStr := time.Now().Format("2006-01-02 15:04:05")
			_, err = m.db.Exec(`UPDATE scheduled_tasks SET last_run_at = ? WHERE id = ?`, nowStr, task.ID)
			if err != nil {
				log.Printf("[Cron] Error updating last_run_at for task %s: %v", task.ID, err)
			}
		})
		if err != nil {
			log.Printf("[Cron] Error adding task %s with expression %q: %v", task.ID, task.CronExpression, err)
			continue
		}
		log.Printf("[Cron] Scheduled task %s with expression %q", task.ID, task.CronExpression)
	}

	return nil
}
