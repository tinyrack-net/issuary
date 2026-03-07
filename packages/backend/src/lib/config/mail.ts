export interface MailTransport {
  sendMail(options: {
    from?: string | undefined;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

export interface MailConfigRuntime {
  from?: string | undefined;
  createTransport: () => Promise<MailTransport>;
}
