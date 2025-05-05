<template>
  <div class="sp-login-holder">
    <form v-on:submit.prevent='submit' class='disBLock'>
      <label for='sp-client-id' class='sp-label sp-required'>Client Id:</label>
      <input placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" v-model.trim='clientId' pattern="[\d\w]{32}" required name='client_id' id='sp-client-id'
             class='sp-input' maxlength="32"/>
      <label for='sp-client-secret' class='sp-label sp-required'>Client Secret:</label>
      <input v-model='clientSecret' maxlength="32" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" pattern="[\d\w]{32}" required name='client_secret' class='sp-input' id='sp-client-secret'/>
      <error :content='error'/>
      <div>
        <button type='submit' class='T-I-atl T-I' :disabled='loading'>
          <span class='icon-spin6'></span> Log In
        </button>
        <input type='button' class='T-I-atl T-I' value='Cancel' @click='cancel'/>
      </div>
    </form>
  </div>
</template>
<style scoped lang="sass">
  #sp-client-id
    margin-bottom: 10px
  #sp-client-secret
    margin-bottom: 15px
  .disBLock > *
    display: block
</style>
<script lang='ts'>
  import Error from './Error.vue';
  import Vue, { ComponentOptions }  from 'vue';
  import {api} from '../helpers/utils';
  import {Page} from '../model';

  interface ILogin extends Vue {
    clientId: string;
    clientSecret: string;
    tries: number;
    error: string;
    loading: boolean;
  }

  export default {
    name: 'login',
    data: function() {
      return {
        clientId: '',
        clientSecret: '',
        error: '',
        tries: 0,
        loading: false
      };
    },
    components: {
      Error
    },
    params: ['value'],
    methods: {
      submit: function () {
        this.loading = true;
        this.tries++;
        let clientId = this.clientId;
        api.login(clientId, this.clientSecret, (token, err) => {
          this.loading = false;
          if (err) {
            this.error = `[${this.tries}] Login error: ${err} `;
          } else {
            this.error = '';
            this.$emit('login');
          }
        });
      },
      cancel: function() {
        this.$emit('setPage', Page.NONE);
      }
    }
  } as ComponentOptions<ILogin>;
</script>
