//go:build windows

package windows

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/Ecotrace/agent/core"
)

// WindowsNotificationInbox implements core.NotificationInbox. It pulls
// notifications from the control plane over outbound HTTPS (no inbound ports)
// and renders them as a Windows system-tray balloon notification (a small
// "side notification" near the clock that works without any packaged AUMID).
type WindowsNotificationInbox struct {
	baseURL    string
	httpClient *http.Client
	getToken   func() string
	on401      func()
}

func NewWindowsNotificationInbox(baseURL string, httpClient *http.Client, getToken func() string, on401 func()) *WindowsNotificationInbox {
	return &WindowsNotificationInbox{
		baseURL:    baseURL,
		httpClient: httpClient,
		getToken:   getToken,
		on401:      on401,
	}
}

func (i *WindowsNotificationInbox) FetchPending() ([]core.Notification, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		i.baseURL+"/api/control/notifications", nil)
	if err != nil {
		return nil, err
	}
	token := i.getToken()
	if token == "" {
		return nil, fmt.Errorf("no access token available")
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized && i.on401 != nil {
		i.on401()
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("notification fetch HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if err != nil {
		return nil, err
	}
	var out struct {
		Notifications []struct {
			ID       int64  `json:"id"`
			Title    string `json:"title"`
			Message  string `json:"message"`
			Severity string `json:"severity"`
		} `json:"notifications"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	items := make([]core.Notification, 0, len(out.Notifications))
	for _, n := range out.Notifications {
		items = append(items, core.Notification{
			ID:       n.ID,
			Title:    n.Title,
			Message:  n.Message,
			Severity: n.Severity,
		})
	}
	return items, nil
}

func (i *WindowsNotificationInbox) Show(n core.Notification) error {
	return showBalloon(n.Title, n.Message, n.Severity)
}

func (i *WindowsNotificationInbox) MarkSeen(id int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		i.baseURL+"/api/control/notifications/"+strconv.FormatInt(id, 10)+"/ack", bytes.NewReader([]byte("{}")))
	if err != nil {
		return err
	}
	token := i.getToken()
	if token == "" {
		return fmt.Errorf("no access token available")
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("ack HTTP %d", resp.StatusCode)
	}
	return nil
}

// showBalloon renders a system-tray balloon notification via PowerShell.
// Works on Windows 10/11 without a packaged app identity.
func showBalloon(title, message, severity string) error {
	if title == "" {
		title = "EcoTrace"
	}
	icon := "Information"
	if severity == "warning" {
		icon = "Warning"
	} else if severity == "critical" {
		icon = "Error"
	}
	t := strings.ReplaceAll(title, "'", "''")
	m := strings.ReplaceAll(message, "'", "''")

	script := fmt.Sprintf(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Text = "EcoTrace"
$icon.Icon = [System.Drawing.SystemIcons]::%s
$icon.Visible = $true
$icon.BalloonTipTitle = '%s'
$icon.BalloonTipText = '%s'
$icon.ShowBalloonTip(10000)
$deadline = (Get-Date).AddSeconds(12)
while ((Get-Date) -lt $deadline) {
  [System.Windows.Forms.Application]::DoEvents()
  Start-Sleep -Milliseconds 100
}
$icon.Dispose()
`, icon, t, m)

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script)
	done := make(chan error, 1)
	go func() { done <- cmd.Run() }()
	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("toast command failed: %w", err)
		}
		return nil
	case <-time.After(25 * time.Second):
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return fmt.Errorf("toast command timed out")
	}
}
