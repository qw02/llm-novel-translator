export class TextPreProcessor {
  constructor(text) {
    this.text = text;
  }

  normalizeText() {
    this.text = this.text.normalize('NFKC');
    return this;
  }

  // Moves contents in ruby annotation to a inside brackets, placed at right side of original location
  processRubyAnnotations() {
    const temp = document.createElement('div');
    temp.innerHTML = this.text;

    temp.querySelectorAll('ruby').forEach(ruby => {
      const baseText = ruby.textContent.replace(/\s+/g, '');
      const rtText = ruby.querySelector('rt')?.textContent || '';
      ruby.textContent = `${baseText}(${rtText})`;
    });

    this.text = temp.textContent;
    return this;
  }

  removeBrTags() {
    this.text = this.text.replace(/<br\s*\/?>/gi, '');
    return this;
  }

  removeNonTextChars() {
    // const pattern = new RegExp('[　◇◆♦＊_＿─\*\\♦︎]+', 'g');
    // this.text = this.text.replace(pattern, '');
    return this;
  }

  trim() {
    this.text = this.text.trim();
    return this;
  }

  getText() {
    return this.text;
  }
}