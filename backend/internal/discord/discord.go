package discord

import (
	"fmt"
	"log"
	"os"

	"cozyroom/internal/api"
	"github.com/bwmarrin/discordgo"
)

type DiscordBot struct {
	session       *discordgo.Session
	aiHandlers    *api.AIHandlers
	allowedUserID string
}

func NewDiscordBot(aiHandlers *api.AIHandlers) *DiscordBot {
	token := os.Getenv("DISCORD_BOT_TOKEN")
	if token == "" {
		log.Println("[Discord] DISCORD_BOT_TOKEN not set, skipping Discord Bot initialization")
		return nil
	}

	allowedID := os.Getenv("DISCORD_ALLOWED_USER_ID")
	if allowedID == "" {
		log.Println("[Discord] DISCORD_ALLOWED_USER_ID not set, skipping Discord Bot initialization")
		return nil
	}

	session, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Printf("[Discord] Error creating session: %v", err)
		return nil
	}

	return &DiscordBot{
		session:       session,
		aiHandlers:    aiHandlers,
		allowedUserID: allowedID,
	}
}

func (db *DiscordBot) Start() error {
	db.session.AddHandler(db.messageCreate)

	// We only need the guilds and guild messages intents
	db.session.Identify.Intents = discordgo.IntentsGuildMessages | discordgo.IntentsDirectMessages

	err := db.session.Open()
	if err != nil {
		return fmt.Errorf("error opening connection: %w", err)
	}

	log.Printf("[Discord] Authorized as %s#%s, listening for secure messages...",
		db.session.State.User.Username, db.session.State.User.Discriminator)
	return nil
}

func (db *DiscordBot) Stop() {
	_ = db.session.Close()
	log.Println("[Discord] Session closed")
}

func (db *DiscordBot) messageCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	// Ignore all messages created by bots (including self)
	if m.Author.Bot {
		return
	}

	// Security Whitelist check
	if m.Author.ID != db.allowedUserID {
		log.Printf("[Discord] Unauthorized access attempt from user %s (%s#%s)",
			m.Author.ID, m.Author.Username, m.Author.Discriminator)
		
		_, _ = s.ChannelMessageSend(m.ChannelID, "🔒 Bạn không có quyền truy cập bot này.")
		return
	}

	log.Printf("[Discord] Processing message from %s: %q", m.Author.Username, m.Content)

	// Send typing indicator
	_ = s.ChannelTyping(m.ChannelID)

	// Execute prompt through AI Agent Runtime
	aiResponse, actions, err := db.aiHandlers.ExecutePrompt("discord", m.Content, nil, "")
	if err != nil {
		log.Printf("[Discord] AI error: %v", err)
		_, _ = s.ChannelMessageSend(m.ChannelID, "❌ Đã xảy ra lỗi khi xử lý yêu cầu của bạn.")
		return
	}

	// Send AI text response
	_, _ = s.ChannelMessageSend(m.ChannelID, aiResponse)

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
			_, _ = s.ChannelMessageSend(m.ChannelID, actionMsg)
		}
	}
}
