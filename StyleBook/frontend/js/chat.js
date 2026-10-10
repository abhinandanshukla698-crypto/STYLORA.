/**
 * StyleBook Real-Time Chat Controller (Salon & Friend-to-Friend Chat)
 * Supports Quick Replies, Real-time Polling, Friend ID / Phone Search, Read Receipts & Notifications
 */
const StyleBookChat = {
  mode: "salon", // "salon" or "friend"
  activeBookingId: null,
  activeFriendId: null,
  bookings: [],
  friendConversations: [],
  pollTimer: null,

  async initChatPage() {
    const user = StyleBookAuth.requireAuth();
    if (!user) return;

    // Display user's own Friend ID
    const myIdEl = document.getElementById("myFriendIdVal");
    if (myIdEl) {
      myIdEl.textContent = `${user.id} (${user.phone})`;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedBookingId = params.get("booking_id");
    const requestedFriendId = params.get("friend_id");
    const requestedMode = params.get("mode");

    if (requestedMode === "friend" || requestedFriendId) {
      await this.switchMode("friend", requestedFriendId);
    } else {
      await this.switchMode("salon", requestedBookingId);
    }

    const sendForm = document.getElementById("chatMessageForm");
    if (sendForm) {
      sendForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("chatMessageInput");
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        await this.sendMessageText(text);
      });
    }

    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => this.loadMessages(true), 3500);
    }
  },

  copyMyFriendId() {
    const user = StyleBookAPI.getCurrentUser();
    if (!user) return;
    const textToCopy = `${user.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
    }
    window.showToast(`Friend ID copied: ${textToCopy} (Share with friends!)`, "success");
  },

  async switchMode(mode, targetId = null) {
    this.mode = mode;
    const tabSalon = document.getElementById("tabSalonChats");
    const tabFriend = document.getElementById("tabFriendChats");
    const friendPane = document.getElementById("friendSearchPane");

    if (tabSalon) tabSalon.classList.toggle("active", mode === "salon");
    if (tabFriend) tabFriend.classList.toggle("active", mode === "friend");
    if (friendPane) friendPane.style.display = mode === "friend" ? "block" : "none";

    const quickReplies = document.getElementById("quickRepliesBar");
    if (quickReplies) {
      if (mode === "friend") {
        quickReplies.innerHTML = `
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('Hey! Let\\'s book a salon visit together!')">Let's book together!</button>
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('Which salon are you going to today?')">Which salon today?</button>
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('Check out StyleBook AI for hairstyle ideas!')">Check AI Styles</button>
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('Are you free this weekend for grooming?')">Free this weekend?</button>
        `;
      } else {
        quickReplies.innerHTML = `
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('What is the current queue?')">What is the current queue?</button>
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('How long will I have to wait?')">How long will I have to wait?</button>
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('Is this service available?')">Is this service available?</button>
          <button type="button" class="quick-reply-chip" onclick="StyleBookChat.sendQuickReply('Can I reschedule my appointment?')">Can I reschedule?</button>
        `;
      }
    }

    if (mode === "salon") {
      await this.loadSalonBookings(targetId);
    } else {
      await this.loadFriendConversations(targetId);
    }
  },

  async loadSalonBookings(requestedBookingId = null) {
    const convListEl = document.getElementById("chatConversationsList");
    if (!convListEl) return;

    try {
      const res = await StyleBookAPI.get("/bookings");
      this.bookings = res.bookings || [];
      if (this.bookings.length === 0) {
        convListEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.88rem;">No active bookings yet.<br><a href="explore.html" class="btn btn-primary btn-sm" style="margin-top:10px;">Book a Salon</a></div>`;
        const msgBox = document.getElementById("chatMessagesBox");
        if (msgBox) msgBox.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">Book an appointment to chat with your salon.</div>`;
        return;
      }

      this.activeBookingId =
        requestedBookingId && this.bookings.some((b) => b.id === requestedBookingId)
          ? requestedBookingId
          : this.bookings[0].id;

      this.renderSalonSidebar();
      await this.loadMessages();
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },

  renderSalonSidebar() {
    const convListEl = document.getElementById("chatConversationsList");
    const user = StyleBookAPI.getCurrentUser();
    if (!convListEl) return;

    convListEl.innerHTML = this.bookings
      .slice(0, 16)
      .map((b) => {
        const isActive = b.id === this.activeBookingId;
        const title = user && user.role === "owner" ? b.customer_name : b.business_name;
        return `
          <div onclick="StyleBookChat.selectBooking('${b.id}')" style="padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:${
          isActive ? "var(--primary-light)" : "#FFFFFF"
        };">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong style="font-size:0.94rem;color:${isActive ? "var(--primary)" : "var(--dark)"};">${title}</strong>
              ${b.queue_number ? `<span class="badge badge-verified mono-num">#${b.queue_number}</span>` : ""}
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);">${b.service_name}</div>
            <div style="font-size:0.75rem;color:var(--text-light);margin-top:2px;">${b.date} • ${b.time} (${b.status})</div>
          </div>
        `;
      })
      .join("");
  },

  async selectBooking(bookingId) {
    this.activeBookingId = bookingId;
    this.renderSalonSidebar();
    await this.loadMessages();
  },

  async loadFriendConversations(targetFriendId = null) {
    const convListEl = document.getElementById("chatConversationsList");
    if (!convListEl) return;

    try {
      const res = await StyleBookAPI.get("/friends/conversations");
      this.friendConversations = res.conversations || [];

      if (targetFriendId && !this.friendConversations.some((c) => c.friend.id === targetFriendId)) {
        // Fetch friend profile to initiate chat
        try {
          const sRes = await StyleBookAPI.get(`/friends/search?q=${targetFriendId}`);
          if (sRes.users && sRes.users.length > 0) {
            this.friendConversations.unshift({
              friend: sRes.users[0],
              last_message: { text: "Chat connected!", timestamp: new Date().toISOString() },
              unread_count: 0,
            });
          }
        } catch (e) {}
      }

      if (this.friendConversations.length > 0) {
        this.activeFriendId =
          targetFriendId || (this.friendConversations[0] && this.friendConversations[0].friend.id);
      } else {
        this.activeFriendId = targetFriendId || null;
      }

      this.renderFriendSidebar();
      await this.loadMessages();
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },

  renderFriendSidebar() {
    const convListEl = document.getElementById("chatConversationsList");
    if (!convListEl) return;

    if (this.friendConversations.length === 0) {
      convListEl.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.86rem;">
          <i class="fa-solid fa-user-plus" style="font-size:2rem;color:var(--primary);margin-bottom:10px;display:block;"></i>
          No friends added yet.<br>
          Search your friend by <strong>Phone Number</strong> or <strong>Friend ID</strong> above to start chatting!
        </div>
      `;
      return;
    }

    convListEl.innerHTML = this.friendConversations
      .map((c) => {
        const isActive = c.friend.id === this.activeFriendId;
        const lastTxt = c.last_message ? c.last_message.text : "No messages yet";
        return `
          <div onclick="StyleBookChat.selectFriend('${c.friend.id}')" style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;background:${
          isActive ? "var(--primary-light)" : "#FFFFFF"
        };display:flex;align-items:center;gap:12px;">
            <img src="${c.friend.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover;" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:0.92rem;color:${isActive ? "var(--primary)" : "var(--dark)"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.friend.name}</strong>
                ${c.unread_count > 0 ? `<span class="badge badge-pending" style="font-size:0.7rem;">${c.unread_count}</span>` : ""}
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${lastTxt}</div>
            </div>
          </div>
        `;
      })
      .join("");
  },

  async selectFriend(friendId) {
    this.activeFriendId = friendId;
    this.renderFriendSidebar();
    await this.loadMessages();
  },

  async searchFriends() {
    const input = document.getElementById("friendSearchInput");
    const resultsEl = document.getElementById("friendSearchResults");
    if (!input || !resultsEl) return;
    const query = input.value.trim();
    if (!query) return;

    resultsEl.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);padding:6px;">Searching users...</div>`;

    try {
      const res = await StyleBookAPI.get(`/friends/search?q=${encodeURIComponent(query)}`);
      const users = res.users || [];
      if (users.length === 0) {
        resultsEl.innerHTML = `<div style="font-size:0.8rem;color:var(--danger);padding:6px;">No users found with "${query}". Check phone or ID.</div>`;
        return;
      }

      resultsEl.innerHTML = users
        .map(
          (u) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#F8FAFC;border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${u.avatar}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />
            <div>
              <strong style="font-size:0.85rem;display:block;">${u.name}</strong>
              <span class="mono-num" style="font-size:0.72rem;color:var(--text-muted);">${u.phone} (${u.id})</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="StyleBookChat.startFriendChat('${u.id}', '${encodeURIComponent(u.name)}')">Chat</button>
        </div>
      `
        )
        .join("");
    } catch (err) {
      resultsEl.innerHTML = `<div style="font-size:0.8rem;color:var(--danger);">${err.message}</div>`;
    }
  },

  async startFriendChat(friendId, friendName) {
    this.activeFriendId = friendId;
    const resultsEl = document.getElementById("friendSearchResults");
    if (resultsEl) resultsEl.innerHTML = "";
    const input = document.getElementById("friendSearchInput");
    if (input) input.value = "";

    await this.loadFriendConversations(friendId);
    window.showToast(`Started chat with ${decodeURIComponent(friendName)}!`, "success");
  },

  async loadMessages(silent = false) {
    const msgBox = document.getElementById("chatMessagesBox");
    const headerTitle = document.getElementById("chatActiveHeader");
    const user = StyleBookAPI.getCurrentUser();

    if (this.mode === "friend") {
      if (!this.activeFriendId) {
        if (headerTitle) headerTitle.innerHTML = `<strong>Search a friend above to start chatting</strong>`;
        if (msgBox) msgBox.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">Enter a Friend ID or Phone Number to connect!</div>`;
        return;
      }

      const activeConv = this.friendConversations.find((c) => c.friend.id === this.activeFriendId);
      const friendObj = activeConv ? activeConv.friend : { name: "Friend", phone: "" };

      if (headerTitle) {
        headerTitle.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${friendObj.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover;" />
            <div>
              <strong style="font-size:1.05rem;display:block;">${friendObj.name}</strong>
              <span class="mono-num" style="font-size:0.78rem;color:var(--text-muted);">${friendObj.phone || friendObj.id}</span>
            </div>
          </div>
          <span class="badge badge-open"><span class="queue-pulse-dot"></span> Online</span>
        `;
      }

      try {
        const res = await StyleBookAPI.get(`/friends/messages/${this.activeFriendId}`);
        const msgs = res.messages || [];
        if (!msgBox) return;

        if (msgs.length === 0) {
          msgBox.innerHTML = `<div style="text-align:center;color:var(--text-muted);margin:auto;">Send a message to start chatting with ${friendObj.name}!</div>`;
        } else {
          msgBox.innerHTML = msgs
            .map((m) => {
              const isMe = user && m.sender_id === user.id;
              const timeStr = (m.timestamp || "").slice(11, 16) || "Just now";
              return `
                <div class="chat-bubble ${isMe ? "sent" : "received"}">
                  <div style="font-weight:600;font-size:0.74rem;margin-bottom:3px;opacity:0.85;">${m.sender_name}</div>
                  <div>${m.text}</div>
                  <div class="mono-num" style="font-size:0.68rem;margin-top:4px;opacity:0.75;text-align:right;">
                    ${timeStr} ${isMe ? (m.read ? "• Read ✓✓" : "• Sent ✓") : ""}
                  </div>
                </div>
              `;
            })
            .join("");
          if (!silent) msgBox.scrollTop = msgBox.scrollHeight;
        }
      } catch (e) {}
    } else {
      // Salon booking chat mode
      if (!this.activeBookingId) return;
      const activeBooking = this.bookings.find((b) => b.id === this.activeBookingId);

      if (headerTitle && activeBooking) {
        const partnerName = user && user.role === "owner" ? activeBooking.customer_name : activeBooking.business_name;
        headerTitle.innerHTML = `
          <div>
            <strong style="font-size:1.05rem;">${partnerName}</strong>
            <span style="display:block;font-size:0.8rem;color:var(--text-muted);">${activeBooking.service_name} • ${
          activeBooking.queue_number ? "Queue #" + activeBooking.queue_number : activeBooking.status
        }</span>
          </div>
          <span class="badge badge-open"><span class="queue-pulse-dot"></span> Online</span>
        `;
      }

      try {
        const res = await StyleBookAPI.get(`/messages/${this.activeBookingId}`);
        const msgs = res.messages || [];
        if (!msgBox) return;

        if (msgs.length === 0) {
          msgBox.innerHTML = `<div style="text-align:center;color:var(--text-muted);margin:auto;">Start a conversation using a quick reply below or type your message.</div>`;
        } else {
          msgBox.innerHTML = msgs
            .map((m) => {
              const isMe = user && m.sender_id === user.id;
              const timeStr = (m.timestamp || "").slice(11, 16) || "Just now";
              return `
                <div class="chat-bubble ${isMe ? "sent" : "received"}">
                  <div style="font-weight:600;font-size:0.74rem;margin-bottom:3px;opacity:0.85;">${m.sender_name}</div>
                  <div>${m.text}</div>
                  <div class="mono-num" style="font-size:0.68rem;margin-top:4px;opacity:0.75;text-align:right;">
                    ${timeStr} ${isMe ? (m.read ? "• Read ✓✓" : "• Sent ✓") : ""}
                  </div>
                </div>
              `;
            })
            .join("");
          if (!silent) msgBox.scrollTop = msgBox.scrollHeight;
        }
      } catch (e) {}
    }
  },

  async sendQuickReply(text) {
    await this.sendMessageText(text);
  },

  async sendMessageText(text) {
    const typingEl = document.getElementById("chatTypingIndicator");
    try {
      if (this.mode === "friend") {
        if (!this.activeFriendId) {
          window.showToast("Please select or search a friend first.", "info");
          return;
        }
        await StyleBookAPI.post("/friends/messages", {
          friend_id: this.activeFriendId,
          text: text,
        });
        await this.loadMessages();
        await this.loadFriendConversations(this.activeFriendId);
      } else {
        if (!this.activeBookingId) return;
        await StyleBookAPI.post("/messages", {
          booking_id: this.activeBookingId,
          text: text,
        });
        await this.loadMessages();

        const user = StyleBookAPI.getCurrentUser();
        if (user && user.role === "customer" && typingEl) {
          typingEl.style.display = "block";
          setTimeout(() => {
            typingEl.style.display = "none";
          }, 1500);
        }
      }
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },
};

window.StyleBookChat = StyleBookChat;
document.addEventListener("DOMContentLoaded", () => StyleBookChat.initChatPage());
