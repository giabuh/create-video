# Chat: image attachments and copy buttons: design

## Goal
The user asked for two things in the app chat with Claude/Codex (2026-11-21):
- send images to the agent;
- copy what a message shows.

They also asked to drop the "(Enter để gửi, Shift+Enter xuống dòng)" hint from the input placeholder. This builds on
the watch & ask screen (`2026-11-21-editor-watch-design.md`), on the same branch `editor-watch`, before it merges.

## Decisions
- **Attaching an image.** There are three ways, all in `ChatBody` (so the drawer and the docked chat both get them):
  - an image button next to the input, which opens the file picker (the gallery or camera on a phone);
  - pasting an image into the input (Ctrl+V);
  - dropping image files on the chat.
- **Before sending.** Attached images show as small previews above the input, each with a remove button.
- **Limits:**
  - at most 4 images per message;
  - each image ≤ 10 MB;
  - types png, jpg/jpeg, webp and gif. No svg: it can carry scripts.
  - The client and the server both check the limits.
- **Storage.** Images are stored in the chat's own folder, `<chatDir>/images/<chatId>/<uuid>.<ext>`.
  - They go neither into `projects/` nor into the library.
  - If the user wants an image in a video, they ask the agent to copy it into the library.
- **How the agent sees them.** The message prompt gets a block listing the absolute paths:
  - the block reads `Attached images (open each file to look at it):` followed by one `- <absolute path>` line per
    image;
  - both engines open local image files with their own tools;
  - no engine-specific flags.
- **A message can be only images.** Empty text is allowed when at least one image is attached. Then the chat title is
  "Ảnh".
- **In the log.** The user message shows its images as thumbnails. Clicking one opens the full image in a new tab.
- **Copy.** Every user message and every agent text message gets a small "Sao chép" button.
  - It copies the text as displayed (the rendered text, without markdown symbols).
  - It works on plain-http LAN access: when `navigator.clipboard` is missing, it falls back to a hidden textarea and
    `document.execCommand('copy')`.
  - A toast says "Đã sao chép".
- **Placeholder.** It becomes `Nhắn Claude…` / `Nhắn Codex…`.

## Server
- **Upload:** `PUT /api/chats/:id/images/:filename`. The body is the raw file.
  - It returns `201 {name}`.
  - Errors: 404 for an unknown chat, 400 for a bad extension, 413 for an image over 10 MB.
- **Serve:** `GET /api/chats/:id/images/:name`. Only names of the form `<uuid>.<ext>` are served, with the right
  `Content-Type` and `X-Content-Type-Options: nosniff`. Anything else is 404.
- **Send:** `POST /api/chats/:id/messages` accepts an optional `images: string[]` of uploaded names.
  - The limit is 4 names, and each must exist for this chat, otherwise 400.
  - The user event stores `images`.
  - The prompt gets the block above.

## Out of scope
- Deleting images when a chat is deleted.
- Attaching a still frame automatically from "Sửa chỗ này": the agent renders its own still.
- Images in agent replies.

## Testing
- **Route tests** (`app/server/routes/chats.test.ts`):
  - upload and serve round trip;
  - each rejection above;
  - the prompt contains the absolute path, checked through the fake CLI echo;
  - an image-only message.
- **Unit tests** for the client helpers: the accept and limit check, and the upload name.
- **Chat E2E** (`app/e2e-chat/chat.spec.ts`): attach a file, send, see the thumbnail and the path in the fake reply,
  then copy a message and read the clipboard.
