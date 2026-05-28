package telegram

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"cozyroom/internal/api"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type TelegramBot struct {
	bot           *tgbotapi.BotAPI
	aiHandlers    *api.AIHandlers
	allowedUserID int64
}

func NewTelegramBot(aiHandlers *api.AIHandlers) *TelegramBot {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		log.Println("[Telegram] TELEGRAM_BOT_TOKEN not set, skipping Telegram Bot initialization")
		return nil
	}

	allowedIDStr := os.Getenv("TELEGRAM_ALLOWED_USER_ID")
	if allowedIDStr == "" {
		log.Println("[Telegram] TELEGRAM_ALLOWED_USER_ID not set, skipping Telegram Bot initialization")
		return nil
	}

	allowedID, err := strconv.ParseInt(allowedIDStr, 10, 64)
	if err != nil {
		log.Printf("[Telegram] Invalid TELEGRAM_ALLOWED_USER_ID %q: %v", allowedIDStr, err)
		return nil
	}

	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		log.Printf("[Telegram] Error creating bot: %v", err)
		return nil
	}

	log.Printf("[Telegram] Authorized as %s", bot.Self.UserName)
	return &TelegramBot{
		bot:           bot,
		aiHandlers:    aiHandlers,
		allowedUserID: allowedID,
	}
}

func (tb *TelegramBot) Start() {
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := tb.bot.GetUpdatesChan(u)
	log.Println("[Telegram] Listening for secure messages...")

	go func() {
		for update := range updates {
			if update.Message == nil {
				continue
			}

			// Security Whitelist check
			if update.Message.From.ID != tb.allowedUserID {
				log.Printf("[Telegram] Unauthorized access attempt from user %d (%s)",
					update.Message.From.ID, update.Message.From.UserName)
				
				msg := tgbotapi.NewMessage(update.Message.Chat.ID, "🔒 Bạn không có quyền truy cập bot này.")
				_, _ = tb.bot.Send(msg)
				continue
			}

			// Send typing indicator
			action := tgbotapi.NewChatAction(update.Message.Chat.ID, "typing")
			_, _ = tb.bot.Send(action)

			log.Printf("[Telegram] Processing message from %s: %q", update.Message.From.UserName, update.Message.Text)

			// Execute prompt through AI Agent Runtime
			aiResponse, actions, err := tb.aiHandlers.ExecutePrompt("telegram", update.Message.Text, nil, "")
			if err != nil {
				log.Printf("[Telegram] AI error: %v", err)
				msg := tgbotapi.NewMessage(update.Message.Chat.ID, "❌ Đã xảy ra lỗi khi xử lý yêu cầu của bạn.")
				_, _ = tb.bot.Send(msg)
				continue
			}

			// Send AI text response
			msg := tgbotapi.NewMessage(update.Message.Chat.ID, aiResponse)
			_, _ = tb.bot.Send(msg)

			// Process and display actions
			for _, act := range actions {
				actType, _ := act["type"].(string)
				if actType != "" {
					title, _ := act["title"].(string)
					artist, _ := act["artist"].(string)
					var actionMsg string
					if title != "" {
						actionMsg = fmt.Sprintf("⚡ [Action] Kích hoạt %s: \"%s\" - %s", actType, title, artist)
					} else {
						actionMsg = fmt.Sprintf("⚡ [Action] Kích hoạt %s", actType)
					}
					msg := tgbotapi.NewMessage(update.Message.Chat.ID, actionMsg)
					_, _ = tb.bot.Send(msg)
				}
			}
		}
	}()
}
