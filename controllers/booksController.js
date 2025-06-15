import dotenv from 'dotenv';
dotenv.config();

import { renderBooksPage } from '../utils/renderBooksPage.js';
import { getFinalCoverUrl } from '../utils/imageUtils.js';
import {
  getAllBooksByUser,
  getBookByUserBookId,
  searchBooksByTitle,
  filterBooksByGenre,
  sortBooksByClause,
  findBookByISBN,
  insertNewBook,
  insertUserBook,
  checkUserBook,
  updateUserBookReview,
  deleteUserBook,
} from '../models/bookModel.js';

// Tampilkan semua buku milik user
export async function getBooks(req, res) {
  const userId = req.session.userId;
  const username = req.session.username;

  try {
    const result = await getAllBooksByUser(userId);

    res.render(
      'pages/books',
      renderBooksPage({
        user: username,
        booksData: result.rows,
      })
    );
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Internal Server Error');
  }
}

// Mendapatkan data buku dengan id
export async function getBookById(req, res) {
  const userBookId = req.params.id;
  const userId = req.session.userId;

  try {
    const result = await getBookByUserBookId(userBookId, userId);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'Book not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

// Mendapatkan data buku berdasarkan judul melalui fitur search
export async function searchBooks(req, res) {
  const title = req.query.search;
  const userId = req.session.userId;
  const username = req.session.username;

  try {
    const result = await searchBooksByTitle(userId, title);

    res.render(
      'pages/books',
      renderBooksPage({
        user: username,
        booksData: result.rows,
      })
    );
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Internal Server Error');
  }
}

// Mendapatkan data buku berdasarkan genre melalui fitur filter genre
export async function filterByGenre(req, res) {
  const genre = req.query.genre;
  const userId = req.session.userId;
  const username = req.session.username;

  try {
    const result = await filterBooksByGenre(userId, genre);

    res.render(
      'pages/books',
      renderBooksPage({
        user: username,
        booksData: result.rows,
      })
    );
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Internal Server Error');
  }
}

// Mengurutkan data buku
export async function sortBooks(req, res) {
  const sort = req.query.sort || '';
  const userId = req.session.userId;
  const username = req.session.username;

  const sortOptions = {
    'title-asc': { column: 'books.title', direction: 'ASC' },
    'title-desc': { column: 'books.title', direction: 'DESC' },
    'date-newest': { column: 'user_books.read_at', direction: 'DESC' },
    'date-oldest': { column: 'user_books.read_at', direction: 'ASC' },
    'author-asc': { column: 'books.author', direction: 'ASC' },
    'author-desc': { column: 'books.author', direction: 'DESC' },
  };

  const selectedSort = sortOptions[sort] || {
    column: 'books.created_at',
    direction: 'DESC',
  };
  const orderByClause = `ORDER BY ${selectedSort.column} ${selectedSort.direction}`;

  try {
    const result = await sortBooksByClause(userId, orderByClause);

    res.render(
      'pages/books',
      renderBooksPage({
        user: username,
        booksData: result.rows,
      })
    );
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Internal Server Error');
  }
}

// Menambahkan buku ke database melalui fitur add book
export async function addBook(req, res) {
  const { title, author, isbn, genre, setting, readability, words, summary } =
    req.body;
  const userId = req.session.userId;

  try {
    const finalCoverUrl = await getFinalCoverUrl(isbn, process.env.API_URL); // Mendapatkan URL gambar yang valid

    if (!finalCoverUrl) {
      return res.status(500).send('Error resolving image URL');
    }

    const existingBook = await findBookByISBN(isbn);

    let bookId;
    // Mendapatkan bookId
    if (existingBook.rows.length > 0) {
      bookId = existingBook.rows[0].id; // Dapatkan bookId dari database
    } else {
      const new_book = await insertNewBook({
        title,
        author,
        finalCoverUrl,
        isbn,
        genre,
      });
      bookId = new_book.rows[0].id; // Tambahkan buku ke database dan dapatkan bookId
    }

    // Tambahkan userId dan bookId ke daftar buku yang sudah dibaca user
    await insertUserBook({
      userId,
      bookId,
      setting,
      readability,
      words,
      summary,
    });
    res.redirect('/books');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
}

// Mengubah isi review buku
export async function updateBookReview(req, res) {
  const userBookId = req.params.id;
  const userId = req.session.userId;
  const { setting, readability, words, summary } = req.body;

  try {
    // Pastikan data buku milik user tersebut
    const check = await checkUserBook(userBookId, userId);

    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'Book not found or access denied' });
    }

    await updateUserBookReview({
      setting,
      readability,
      words,
      summary,
      userBookId,
    });

    res.redirect('/books');
  } catch (err) {
    console.error('Error updating book:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Menghapus buku dari database user_books
export async function deleteBook(req, res) {
  const userBookId = req.params.id;

  try {
    await deleteUserBook(userBookId);
    res.status(200).send('Book deleted');
  } catch (err) {
    console.error('Error deleting book:', err.message);
    res.status(500).send('Error deleting book');
  }
}
