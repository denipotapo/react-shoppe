import { Observable } from 'rxjs';
import { browserHistory as history } from 'react-router';
import { combineEpics } from 'redux-observable';
import * as api from './api.js';

const initialState = {
  search: '',
  cart: [],
  products: [],
  productsById: {},
  token: null,
  user: {},
  isSignedIn: false
};


export const types = {
  UPDATE_PRODUCTS_FILTER: 'UPDATE_PRODUCTS_FILTER',
  FETCH_PRODUCTS: 'FETCH_PRODUCTS',
  FETCH_PRODUCTS_COMPLETE: 'FETCH_PRODUCTS_COMPLETE',
  FETCH_PRODUCTS_ERROR: 'FETCH_PRODUCTS_ERROR',
  AUTO_LOGIN: 'AUTO_LOGIN',
  AUTO_LOGIN_NO_USER: 'AUTO_LOGIN_NO_USER',
  UPDATE_USER: 'UPDATE_USER',
  UPDATE_USER_COMPLETE: 'UPDATE_USER_COMPLETE',
  UPDATE_USER_ERROR: 'UPDATE_USER_ERROR',

  ADD_TO_CART: 'ADD_TO_CART',
  REMOVE_FROM_CART: 'REMOVE_FROM_CART',
  DELETE_FROM_CART: 'DELETE_FROM_CART',
  UPDATE_CART: 'UPDATE_CART',
  UPDATE_CART_ERROR: 'UPDATE_CART_ERROR'
};

export const updateFilter = e => {
  return {
    type: types.UPDATE_PRODUCTS_FILTER,
    search: e.target.value
  };
};

export function fetchProductsEpic(actions, _, { fetcher }) {
  return actions.ofType(types.FETCH_PRODUCTS)
    .switchMap(() => {
      return Observable.fromPromise(
        fetcher.read('products').end()
      )
        .map(fetchProductsComplete)
        .catch(err => Observable.of({
          type: types.FETCH_PRODUCTS_ERROR,
          err
        }));
    });
}

export const fetchProducts = () => ({ type: types.FETCH_PRODUCTS });
// export function fetchProducts() {
//   return dispatch => {
//     dispatch({ type: types.FETCH_PRODUCTS });
//     api.fetchProducts()
//       .then(products => dispatch(fetchProductsComplete(products)))
//       .catch(err => dispatch({
//         type: types.FETCH_PRODUCTS_ERROR,
//         error: true,
//         payload: err
//       }));
//   };
// }

export function fetchProductsComplete(products) {
  return {
    type: types.FETCH_PRODUCTS_COMPLETE,
    products
  };
}


export function auth(isSignUp, e) {
  e.preventDefault();
  return (dispatch, getState, { localStorage }) => {
    dispatch({ type: types.UPDATE_USER });
    api.auth(isSignUp, e.target)
      .then(user => {
        if (user.id && user.accessToken) {
          localStorage.setItem('userId', user.id);
          localStorage.setItem('token', user.accessToken);
        }
        return user;
      })
      .then(user => dispatch({
        type: types.UPDATE_USER_COMPLETE,
        user
      }))
      .then(() => {
        history.push('/');
      })
      .catch(err => dispatch({
        type: types.UPDATE_USER_ERROR,
        error: true,
        payload: err
      }));
  };
}

// 1 Observable.of(1, 2, 3).subscribe(x => console.log(x)); => 1\n 2\n 3\n
// 2 Observable.of([1, 2, 3]).subscribe(x => console.log(x)); => [1, 2, 3]\n
// 3 Observable.from([1, 2, 3]).subscribe(x => console.log(x)); => 1\n 2\n 3\n
// 4 Observable.from(1, 2, 3).subscribe(x => console.log(x)); => throws
export function autoLoginEpic(actions, _, { localStorage }) {
  return actions.ofType(types.AUTO_LOGIN)
    // mergeMap concatMap
    // .filter(() => (
    //   localStorage.getItem('userId') || localStorage.getItem('token')
    // ))
    .switchMap(() => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      if (!userId || !token) {
        // return [ { type: types.AUTO_LOGIN_NO_USER } ];
        return Observable.of({ type: types.AUTO_LOGIN_NO_USER });
      }
      // return { type: 'USER_FOUND' };
      return Observable.fromPromise(api.fetchUser(userId, token))
        .map(user => ({
          type: types.UPDATE_USER_COMPLETE,
          user
        }))
        .catch(err => {
          delete localStorage.userId;
          delete localStorage.token;
          return Observable.of({
            type: types.UPDATE_USER_ERROR,
            error: true,
            payload: err
          });
        });
    });
}

export const autoLogin = () => ({
  type: types.AUTO_LOGIN
});
// export function autoLogin() {
//   return (dispatch, getState, { storage }) => {
//     dispatch({ type: types.AUTO_LOGIN });
//     if (!storage.userId || !storage.token) {
//       return dispatch({ type: types.AUTO_LOGIN_NO_USER });
//     }
//     return api.fetchUser(storage.userId, storage.token)
//       .then(user => dispatch({
//         type: types.UPDATE_USER_COMPLETE,
//         user
//       }))
//       .catch(err => {
//         delete storage.userId;
//         delete storage.token;
//         dispatch({
//           type: types.UPDATE_USER_ERROR,
//           error: true,
//           payload: err
//         });
//     });
//   };
// }

export function cartEpic(actions, store) {
  return actions.ofType(
    types.ADD_TO_CART,
    types.REMOVE_FROM_CART,
    types.DELETE_FROM_CART
  )
    .map(action => {
      const {
        user: { id },
        token
      } = store.getState();
      return { ...action, id, token };
    })
    .filter(({ id, token }) => {
      return id && token;
    })
    .switchMap(({ type, itemId, id, token }) => {
      return Observable.fromPromise(
        api.makeCartApiCall(type, id, token, itemId)
      )
        .map(({ cart }) => ({ type: types.UPDATE_CART, cart }))
        .catch(err => Observable.of({ type: types.UPDATE_CART_ERROR, err }));
    });
}

// function makeCartThunk(type) {
//   return itemId => (dispatch, getState) => {
//     const {
//       user: { id },
//       token
//     } = getState();

//     if (id && token) {
//       api.makeCartApiCall(type, id, token, itemId)
//         .then(({ cart }) => dispatch({
//           type: types.UPDATE_CART,
//           cart
//         }));
//     }
//   };
// }
export const addToCart = (itemId) => ({
  type: types.ADD_TO_CART,
  itemId
});
export const removeFromCart = (itemId) => ({
  type: types.REMOVE_FROM_CART,
  itemId
});
export const deleteFromCart = (itemId) => ({
  type: types.DELETE_FROM_CART,
  itemId
});

export const cartSelector = state => state.cart;
// state => [...Product]
export const productSelector = state => {
  return state.products.map(id => state.productsById[id]);
};

export const rootEpic = combineEpics(
  cartEpic,
  autoLoginEpic,
  fetchProductsEpic
);

export default function reducer(state = initialState, action) {
  if (action.type === types.UPDATE_USER_COMPLETE) {
    const { user } = action;
    return {
      ...state,
      user,
      cart: user.cart || [],
      token: user.accessToken,
      isSignedIn: !!user.username
    };
  }


  if (action.type === types.UPDATE_CART) {
    return {
      ...state,
      cart: action.cart
    };
  }

  if (action.type === types.UPDATE_PRODUCTS_FILTER) {
    return {
      ...state,
      search: action.search
    };
  }

  if (action.type === types.FETCH_PRODUCTS_COMPLETE) {
    return {
      ...state,
      products: action.products.map(product => product.id),
      productsById: action.products.reduce((productsById, product) => {
        productsById[product.id] = product;
        return productsById;
      }, {})
    };
  }
  return state;
}