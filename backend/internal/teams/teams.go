package teams

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"cozyroom/internal/api"
)

// TeamsBot handles Microsoft Teams bot webhook activities.
type TeamsBot struct {
	appID       string
	appPassword string
	aiHandlers  *api.AIHandlers
	httpClient  *http.Client

	// per-conversation history (in-memory, resets on restart)
	histMu  sync.Mutex
	history map[string][]api.ChatMessage
}

type activity struct {
	Type         string              `json:"type"`
	ID           string              `json:"id"`
	ServiceURL   string              `json:"serviceUrl"`
	From         channelAccount      `json:"from"`
	Recipient    channelAccount      `json:"recipient"`
	Conversation conversationAccount `json:"conversation"`
	Text         string              `json:"text"`
}

type channelAccount struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type conversationAccount struct {
	ID string `json:"id"`
}

func NewTeamsBot(aiHandlers *api.AIHandlers) *TeamsBot {
	appID := os.Getenv("TEAMS_APP_ID")
	appPassword := os.Getenv("TEAMS_APP_PASSWORD")
	if appID == "" || appPassword == "" {
		log.Println("[Teams] TEAMS_APP_ID or TEAMS_APP_PASSWORD not set, skipping")
		return nil
	}
	return &TeamsBot{
		appID:       appID,
		appPassword: appPassword,
		aiHandlers:  aiHandlers,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
		history:     make(map[string][]api.ChatMessage),
	}
}

// Handler returns the HTTP handler for Teams webhook POST /teams/messages.
func (tb *TeamsBot) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var act activity
		if err := json.NewDecoder(r.Body).Decode(&act); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		// Only process message activities with text
		if act.Type != "message" || strings.TrimSpace(act.Text) == "" {
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Printf("[Teams] Message from %s (%s): %q", act.From.Name, act.From.ID, act.Text)
		w.WriteHeader(http.StatusOK) // acknowledge immediately

		go func() {
			convID := act.Conversation.ID
			sessionID := "teams-" + convID

			tb.histMu.Lock()
			hist := tb.history[convID]
			tb.histMu.Unlock()

			aiResp, actions, err := tb.aiHandlers.ExecutePrompt(sessionID, act.Text, hist, "")
			if err != nil {
				log.Printf("[Teams] AI error: %v", err)
				tb.reply(act, "❌ Lỗi xử lý yêu cầu.")
				return
			}

			// Update history (cap at 8 turns)
			newHist := append(hist,
				api.ChatMessage{Role: "user", Content: act.Text},
				api.ChatMessage{Role: "assistant", Content: aiResp},
			)
			if len(newHist) > 16 {
				newHist = newHist[len(newHist)-16:]
			}
			tb.histMu.Lock()
			tb.history[convID] = newHist
			tb.histMu.Unlock()

			// Append action lines to response
			var sb strings.Builder
			sb.WriteString(aiResp)
			for _, a := range actions {
				actType, _ := a["type"].(string)
				title, _ := a["title"].(string)
				artist, _ := a["artist"].(string)
				if actType == "play_track" && title != "" {
					sb.WriteString(fmt.Sprintf("\n\n▶ **%s**", title))
					if artist != "" {
						sb.WriteString(" — " + artist)
					}
				}
			}

			tb.reply(act, sb.String())
		}()
	}
}

func (tb *TeamsBot) reply(incoming activity, text string) {
	token, err := tb.getToken()
	if err != nil {
		log.Printf("[Teams] getToken error: %v", err)
		return
	}

	reply := map[string]any{
		"type":         "message",
		"text":         text,
		"textFormat":   "markdown",
		"replyToId":    incoming.ID,
		"from":         incoming.Recipient,
		"recipient":    incoming.From,
		"conversation": incoming.Conversation,
	}

	serviceURL := incoming.ServiceURL
	if !strings.HasSuffix(serviceURL, "/") {
		serviceURL += "/"
	}
	url := fmt.Sprintf("%sv3/conversations/%s/activities/%s",
		serviceURL, incoming.Conversation.ID, incoming.ID)

	body, _ := json.Marshal(reply)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		log.Printf("[Teams] reply request error: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := tb.httpClient.Do(req)
	if err != nil {
		log.Printf("[Teams] reply send error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("[Teams] reply non-OK status: %d", resp.StatusCode)
	}
}

func (tb *TeamsBot) getToken() (string, error) {
	data := fmt.Sprintf(
		"grant_type=client_credentials&client_id=%s&client_secret=%s&scope=https%%3A%%2F%%2Fapi.botframework.com%%2F.default",
		tb.appID, tb.appPassword,
	)
	resp, err := tb.httpClient.Post(
		"https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(data),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Error != "" {
		return "", fmt.Errorf("%s: %s", result.Error, result.ErrorDesc)
	}
	return result.AccessToken, nil
}
