export type FlashcardInlineEditField =
  | "lemma"
  | "definition"
  | "translation_zh"
  | "examples"
  | "unnatural_english"
  | "synonyms"
  | "antonyms"
  | "collocations"
  | "tag_ids"
  | "part_of_speech"
  | "ipa";

export type FlashcardInlineEditHandler = (
  field: FlashcardInlineEditField,
  value: string
) => void;

/** Editable slices on the word detail flashcard; one active at a time. Front face is image-only — text edits are on the back. */
export type WordCardEditSectionId =
  | "back_header"
  | "back_definition"
  | "back_synonyms"
  | "back_antonyms"
  | "back_collocations"
  | "back_examples"
  | "back_unnatural_english";

export type WordCardTextSectionId = WordCardEditSectionId;

export type WordCardSectionEditProps = {
  editingSectionId: WordCardEditSectionId | null;
  sectionSaving: boolean;
  onStartSectionEdit: (id: WordCardEditSectionId) => void;
  onCancelSectionEdit: () => void;
  onSaveTextSection: (id: WordCardTextSectionId) => Promise<void>;
  onSectionFieldChange: FlashcardInlineEditHandler;
};

/** My Words browse: pencil opens a dedicated edit page per section. */
export type WordCardBrowseEditProps = {
  wordId: string;
};
