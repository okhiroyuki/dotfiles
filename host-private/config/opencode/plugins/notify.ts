import { type Plugin } from "@opencode-ai/plugin"

function appleScriptQuote(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

async function notify(message: string) {
  const script = `display notification "${appleScriptQuote(message)}" with title "opencode" sound name "Glass"`
  await Bun.spawn(["osascript", "-e", script], { stdout: "ignore", stderr: "ignore" }).exited.catch(() => {})
}

export const NotifyPlugin: Plugin = async () => {
  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.idle":
          return notify("応答が完了したよ")
        case "permission.asked":
          return notify("許可の確認が必要")
      }
    },
  }
}
