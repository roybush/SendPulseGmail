<template>
  <div>
    <div class='inline'>
      <input type='text' v-model='email'/>
      <input type='button' value='add' @click='add'/>
    </div>
    <table>
      <tr class='x7' v-for='(email, index) in emails'>
        <td><span :email='email'>{{ email }}</span></td>
        <td> <input type='button' @click='deleteMail(index)' value='X' /></td>
      </tr>
    </table>
  </div>
</template>
<style lang='sass' scoped>
  .inline > *
    display: inline-block
</style>
<script lang='ts'>

  export default {
    name: 'dev-app',
    data: function() {
      return {
        emails: ['email1@gmail.com', 'email2@gmail.com'],
        email: 'newEmail@gmail.com'
      };
    },
    methods: {
      deleteMail: function (i) {
        this.emails.splice(i, 1);
      },
      add: function() {
        this.emails.push(this.email);
      }
    }
  };

</script>
