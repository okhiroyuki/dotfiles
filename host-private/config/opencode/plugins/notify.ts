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
        case "question.asked": {
          const header = event.properties.questions[0]?.header
          return notify(header ? `回答が必要: ${header}` : "質問への回答が必要")
        }
        case "session.error": {
          const message = event.properties.error?.data.message
          return notify(message ? `エラー: ${message.slice(0, 100)}` : "エラーが発生したよ")
        }
      }
    },
  }
}
