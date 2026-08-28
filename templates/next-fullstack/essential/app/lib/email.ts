import nodemailer from "nodemailer";

export async function sendExampleEmail(): Promise<void> {
  const port = Number(process.env.ZERO_MAILPIT_SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("E-mail local indisponível.");
  const transport = nodemailer.createTransport({ host: "127.0.0.1", port, secure: false });
  await transport.sendMail({
    from: "zero@local.test",
    to: "demo@local.test",
    subject: "Zero complete pronto",
    text: "Mensagem de teste enviada exclusivamente ao Mailpit local.",
  });
}
