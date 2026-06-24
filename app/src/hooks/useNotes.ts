/**
 * Our Story Notes Hook
 */

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { QuestionNote, TopicNotes } from '@/lib/notes/types';

const NOTES_KEY = 'interview-our-story-notes-v1';

const DEFAULT_TOPIC_NOTES: TopicNotes = {
  topicId: '',
  generalNotes: '',
  questionNotes: {},
};

export function useNotes() {
  const [allNotes, setAllNotes] = useLocalStorage<Record<string, TopicNotes>>(
    NOTES_KEY,
    {}
  );

  // Get notes for a specific topic
  const getTopicNotes = useCallback((topicId: string): TopicNotes => {
    return allNotes[topicId] || { ...DEFAULT_TOPIC_NOTES, topicId };
  }, [allNotes]);

  // Get note for a specific question
  const getQuestionNote = useCallback((topicId: string, questionId: string): QuestionNote | null => {
    const topicNotes = allNotes[topicId];
    if (!topicNotes) return null;
    return topicNotes.questionNotes[questionId] || null;
  }, [allNotes]);

  // Save note for a question
  const saveQuestionNote = useCallback((
    topicId: string,
    questionId: string,
    note: Partial<QuestionNote>
  ) => {
    setAllNotes(prev => {
      const topicNotes = prev[topicId] || { ...DEFAULT_TOPIC_NOTES, topicId };
      const existingNote = topicNotes.questionNotes[questionId];
      
      const updatedNote: QuestionNote = {
        ...existingNote,
        questionId,
        ourAnswer: note.ourAnswer ?? existingNote?.ourAnswer ?? '',
        keyDates: note.keyDates ?? existingNote?.keyDates ?? '',
        locations: note.locations ?? existingNote?.locations ?? '',
        names: note.names ?? existingNote?.names ?? '',
        evidenceNotes: note.evidenceNotes ?? existingNote?.evidenceNotes ?? '',
        updatedAt: new Date().toISOString(),
      };

      return {
        ...prev,
        [topicId]: {
          ...topicNotes,
          questionNotes: {
            ...topicNotes.questionNotes,
            [questionId]: updatedNote,
          },
        },
      };
    });
  }, [setAllNotes]);

  // Save general topic notes
  const saveTopicNotes = useCallback((topicId: string, generalNotes: string) => {
    setAllNotes(prev => {
      const topicNotes = prev[topicId] || { ...DEFAULT_TOPIC_NOTES, topicId };
      return {
        ...prev,
        [topicId]: {
          ...topicNotes,
          generalNotes,
        },
      };
    });
  }, [setAllNotes]);

  // Check if a question has notes
  const hasNotes = useCallback((topicId: string, questionId: string): boolean => {
    const note = allNotes[topicId]?.questionNotes[questionId];
    if (!note) return false;
    return !!(note.ourAnswer || note.keyDates || note.locations || note.names || note.evidenceNotes);
  }, [allNotes]);

  // Get all notes that have content
  const getAllNotesWithContent = useCallback((): { topicId: string; questionId: string; note: QuestionNote }[] => {
    const result: { topicId: string; questionId: string; note: QuestionNote }[] = [];
    
    Object.entries(allNotes).forEach(([topicId, topicNotes]) => {
      Object.entries(topicNotes.questionNotes).forEach(([questionId, note]) => {
        if (note.ourAnswer || note.keyDates || note.locations || note.names || note.evidenceNotes) {
          result.push({ topicId, questionId, note });
        }
      });
    });

    return result.sort((a, b) => 
      new Date(b.note.updatedAt).getTime() - new Date(a.note.updatedAt).getTime()
    );
  }, [allNotes]);

  return {
    allNotes,
    getTopicNotes,
    getQuestionNote,
    saveQuestionNote,
    saveTopicNotes,
    hasNotes,
    getAllNotesWithContent,
  };
}

export type NotesHookReturn = ReturnType<typeof useNotes>;
