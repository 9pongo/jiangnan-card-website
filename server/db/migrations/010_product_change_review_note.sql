ALTER TABLE product_change_proposals
  ADD COLUMN review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 400);
