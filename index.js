
const { summarize } = require("./prompts");

class ChatSummary {
    constructor(max_tokens = 1024, token_count, max_input_tokens) {
        this.token_count = token_count;
        this.max_tokens = max_tokens;
        this.max_input_tokens = max_input_tokens;
    }

    too_big(messages) {
        const sized = this.tokenize(messages);
        const total = sized.reduce((acc, [tokens]) => acc + tokens, 0);
        return total > this.max_tokens;
    }

    tokenize(messages) {
        const sized = messages.map(msg => [this.token_count(msg), msg]);
        return sized;
    }

    summarize(messages, depth = 0) {
        const sized = this.tokenize(messages);
        const total = sized.reduce((acc, [tokens]) => acc + tokens, 0);

        if (total <= this.max_tokens && depth === 0) {
            return messages;
        }

        const min_split = 4;
        if (messages.length <= min_split || depth > 3) {
            return this.summarize_all(messages);
        }

        let tail_tokens = 0;
        let split_index = messages.length;
        const half_max_tokens = Math.floor(this.max_tokens / 2);

        for (let i = sized.length - 1; i >= 0; i--) {
            const [tokens] = sized[i];
            if (tail_tokens + tokens < half_max_tokens) {
                tail_tokens += tokens;
                split_index = i;
            } else {
                break;
            }
        }

        while (messages[split_index - 1].role !== 'assistant' && split_index > 1) {
            split_index--;
        }

        if (split_index <= min_split) {
            return this.summarize_all(messages);
        }

        const head = messages.slice(0, split_index).reverse();
        const tail = messages.slice(split_index);

        let keep = [];
        let total_tokens = 0;
        const model_max_input_tokens = this.max_input_tokens - 512 || 4096 - 512;

        for (let i = 0; i < split_index; i++) {
            total_tokens += sized[i][0];
            if (total_tokens > model_max_input_tokens) {
                break;
            }
            keep.push(head[i]);
        }

        keep.reverse();
        const summary = this.summarize_all(keep);

        const tail_tokens_final = sized.slice(split_index).reduce((acc, [tokens]) => acc + tokens, 0);
        const summary_tokens = this.token_count(summary);

        const result = summary.concat(tail);
        if (summary_tokens + tail_tokens_final < this.max_tokens) {
            return result;
        }

        return this.summarize(result, depth + 1);
    }

    summarize_all(messages) {
        let content = '';
        for (const msg of messages) {
            const role = msg.role.toUpperCase();
            if (!['USER', 'ASSISTANT'].includes(role)) {
                continue;
            }
            content += `# ${role}\n${msg.content}`;
            if (!content.endsWith('\n')) {
                content += '\n';
            }
        }

        const message_payload = [
            { role: 'system', content: summarize },
            { role: 'user', content: content },
        ];

        return message_payload;
    }
}

module.exports = {
    ChatSummary
};

